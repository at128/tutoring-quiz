# HTTP API contract (v1 — locked)

Owner: Claude Code, with human approval required for contract changes. The frontend implementation (`frontend/src/api/types.ts`) must mirror this file exactly. Codex reviews contract consistency at checkpoints.

## Conventions
- Base path `/api`. JSON, camelCase, UTF-8. Enums are strings. IDs are GUID strings. Times are ISO-8601 UTC with `Z`.
- Auth is an HttpOnly cookie set by login; the SPA sends `credentials: "same-origin"`.
- Errors are RFC 9457 ProblemDetails (`application/problem+json`):
```json
{ "type": "about:blank", "title": "Quiz is closed", "status": 409, "code": "quiz.closed", "detail": "This quiz closed at 2026-09-24T09:00:00Z." }
```
  Validation errors add `"errors": { "questions[2].options": ["Exactly one option must be correct."] }`.
- Ownership failures return **404** (not 403) so existence isn't leaked. Wrong role → 403. No session → 401.

## Error codes
| code | status | when |
|---|---|---|
| `auth.invalid_credentials` | 401 | wrong username/password |
| `auth.unauthenticated` | 401 | no/expired session |
| `auth.forbidden` | 403 | wrong role for the endpoint, or a change sent from another website's page (CSRF guard, see ARCHITECTURE.md) |
| `rate_limited` | 429 | too many login attempts |
| `validation_failed` | 400 | request body invalid (`errors` present) |
| `not_found` | 404 | missing, not owned, not assigned, or unpublished (student) |
| `quiz.not_open_yet` | 409 | start before OpensAt |
| `quiz.closed` | 409 | start at/after ClosesAt |
| `attempt.already_taken` | 409 | student already has a finalized attempt |
| `attempt.deadline_passed` | 409 | answer save after deadline (attempt is finalized as Expired; the late answer is not saved) |
| `attempt.not_in_progress` | 409 | answer save on a finalized attempt |
| `attempt.not_finalized` | 409 | result requested while still in progress |
| `answer.invalid_option` | 400 | question not in this quiz / option not in this question |
| `quiz.locked` | 409 | content edit on a quiz that has attempts |
| `quiz.has_attempts` | 409 | unpublish/delete a quiz that has attempts |
| `quiz.invalid_for_publish` | 400 | publish without questions / close time in the past (`errors` present) |

## Shared shapes
```ts
type Role = "Student" | "Teacher";
type CurrentUser = { id: string; username: string; fullName: string; role: Role; classRoom: { id: string; name: string } | null };

type AttemptStatus = "InProgress" | "Submitted" | "Expired";
type StudentQuizStatus = "Upcoming" | "Available" | "InProgress" | "Completed" | "Missed";
type TeacherQuizState = "Draft" | "Scheduled" | "Open" | "Closed";
type ResultRowStatus = "NotStarted" | "InProgress" | "Submitted" | "Expired" | "Missed";

type AttemptResult = {
  attemptId: string; quizId: string; quizTitle: string; status: "Submitted" | "Expired";
  startedAt: string; finalizedAt: string;
  score: number; maxScore: number; percentage: number;
  correctCount: number; wrongCount: number; unansweredCount: number;
  wrongAnswerPenaltyPercent: number;
  reviewAvailableAt: string;            // = quiz closesAt
  review: ReviewItem[] | null;          // null until the quiz has closed (stretch S2; always null if not built)
};
type ReviewItem = { questionId: string; text: string; points: number; options: { id: string; text: string }[];
                    selectedOptionId: string | null; correctOptionId: string; earned: number };
```

## Health
`GET /api/health` (anonymous) → `200 { "status": "ok" }`

## Auth
`POST /api/auth/login` (anonymous, rate limited) body `{ "username": "10a-01", "password": "…" }` → `200 CurrentUser` + `Set-Cookie`. Username is case-insensitive. Errors: 400, 401 `auth.invalid_credentials`, 429.
`POST /api/auth/logout` → `204` (clears cookie; idempotent).
`GET /api/auth/me` → `200 CurrentUser` | 401.

## Student endpoints (role Student)
### `GET /api/student/quizzes`
```ts
type StudentQuizList = { serverNow: string; quizzes: StudentQuizCard[] };
type StudentQuizCard = {
  id: string; title: string; description: string | null; teacherName: string;
  opensAt: string; closesAt: string; durationMinutes: number;
  questionCount: number; maxScore: number; wrongAnswerPenaltyPercent: number;
  status: StudentQuizStatus;
  effectiveMinutesIfStartedNow: number | null;   // only when Available: min(duration, minutes until close), rounded down
  attempt: { id: string; status: AttemptStatus; deadline: string; score: number | null; maxScore: number } | null;
};
```
Only published quizzes assigned to the student's class. Expired attempts are finalized before building the list. Order: InProgress, Available (closing soonest first), Upcoming (opening soonest first), Completed (most recent first), Missed.

### `POST /api/student/quizzes/{quizId}/attempt`
No body. → `201 AttemptView` (new) or `200 AttemptView` (existing in-progress attempt — resume). Errors: 404, 409 `quiz.not_open_yet` | `quiz.closed` | `attempt.already_taken`.

### `GET /api/student/attempts/{attemptId}`
→ `200 AttemptView`. If the attempt is (or just became) finalized, `questions` is `[]` and `result` is set.
```ts
type AttemptView = {
  id: string; quizId: string; quizTitle: string; status: AttemptStatus;
  startedAt: string; deadline: string; serverNow: string;
  wrongAnswerPenaltyPercent: number; maxScore: number;
  questions: { id: string; order: number; text: string; points: number;
               options: { id: string; order: number; text: string }[];   // never isCorrect
               selectedOptionId: string | null }[];
  result: AttemptResult | null;
};
```

### `PUT /api/student/attempts/{attemptId}/answers/{questionId}`
Body `{ "selectedOptionId": "guid" | null }` (null clears the answer) → `200 { "questionId": "…", "selectedOptionId": "…" | null, "savedAt": "…" }`. Errors: 404, 400 `answer.invalid_option`, 409 `attempt.deadline_passed` | `attempt.not_in_progress`. Idempotent.

### `POST /api/student/attempts/{attemptId}/submit`
No body (ignored if sent). → `200 AttemptResult`. Idempotent: submitting a finalized attempt returns its result. A submit after the deadline finalizes as `Expired` with the saved answers.

### `GET /api/student/attempts/{attemptId}/result`
→ `200 AttemptResult` | 409 `attempt.not_finalized` | 404.

## Teacher endpoints (role Teacher; only the teacher's own quizzes)
### `GET /api/teacher/classrooms`
→ `200 [{ "id": "…", "name": "10A", "studentCount": 20 }]`

### `GET /api/teacher/quizzes`
```ts
type TeacherQuizSummary = {
  id: string; title: string; classRooms: { id: string; name: string }[];
  opensAt: string; closesAt: string; durationMinutes: number; wrongAnswerPenaltyPercent: number;
  isPublished: boolean; state: TeacherQuizState; isLocked: boolean;
  questionCount: number; maxScore: number;
  assignedStudentCount: number; startedCount: number; finalizedCount: number;
};
```
Ordered: Open, Scheduled, Draft, Closed; then by opensAt.

### `POST /api/teacher/quizzes` body `QuizUpsert` → `201 { "id": "…" }` (+ `Location`). Created as draft (unpublished).
### `GET /api/teacher/quizzes/{id}` → `200 QuizEditorView`
### `PUT /api/teacher/quizzes/{id}` body `QuizUpsert` → `200 QuizEditorView`. Replaces all questions/options. 409 `quiz.locked` if the quiz has attempts.
```ts
type QuizUpsert = {
  title: string; description: string | null; classRoomIds: string[];
  opensAt: string; closesAt: string;              // UTC ISO; the browser converts from local input
  durationMinutes: number; wrongAnswerPenaltyPercent: number;
  questions: { text: string; points: number; options: { text: string; isCorrect: boolean }[] }[];  // order = array order
};
type QuizEditorView = Omit<QuizUpsert, "questions" | "classRoomIds"> & {
  id: string; classRooms: { id: string; name: string }[];
  isPublished: boolean; state: TeacherQuizState; isLocked: boolean; maxScore: number;
  questions: { id: string; order: number; text: string; points: number;
               options: { id: string; order: number; text: string; isCorrect: boolean }[] }[];
};
```

### `POST /api/teacher/quizzes/{id}/publish` → `200 QuizEditorView` | 400 `quiz.invalid_for_publish`
### `POST /api/teacher/quizzes/{id}/unpublish` → `200 QuizEditorView` | 409 `quiz.has_attempts`
### `DELETE /api/teacher/quizzes/{id}` → `204` | 409 `quiz.has_attempts`

### `GET /api/teacher/quizzes/{id}/results`
Finalizes expired attempts first.
```ts
type QuizResults = {
  quiz: { id: string; title: string; opensAt: string; closesAt: string; durationMinutes: number;
          wrongAnswerPenaltyPercent: number; maxScore: number; state: TeacherQuizState };
  summary: { assignedCount: number; startedCount: number; finalizedCount: number;
             averageScore: number | null; highestScore: number | null; lowestScore: number | null;
             averagePercentage: number | null };
  rows: { studentId: string; fullName: string; username: string; classRoom: string;
          status: ResultRowStatus; attemptId: string | null;
          startedAt: string | null; finalizedAt: string | null;
          score: number | null; maxScore: number; percentage: number | null }[];   // ordered by classRoom, then fullName
};
```

## Stretch endpoints (only if PLAN.md reaches them)
- S1 `GET /api/teacher/quizzes/{id}/results.csv` — `text/csv; charset=utf-8` **with UTF-8 BOM** so Excel shows Arabic names correctly; `Content-Disposition: attachment`.
- S2 correct-answer review: fill `AttemptResult.review` once `serverNow >= closesAt`.
- S3 `POST /api/teacher/quizzes/{id}/extend` body `{ "closesAt": "…" }` — allowed when locked, only later than the current close time.
- S5 `GET /api/teacher/quizzes/{id}/question-stats` → `[{ "questionId", "order", "text", "correctRate", "unansweredRate" }]`.
