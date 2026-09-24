# Domain model and business rules

Everything in this file is enforced on the server. The frontend may *display* these rules but is never trusted to apply them.

## Entities
| Entity | Fields (all times UTC) | Notes |
|---|---|---|
| **ClassRoom** | Id, Name (`10A`), Grade (int) | Name unique. |
| **User** | Id, Username, UsernameNormalized, FullName, Role (`Student`/`Teacher`), PasswordHash, ClassRoomId? | Students have exactly one ClassRoom; teachers none. FullName up to 150 chars, any script. |
| **Quiz** | Id, TeacherId, Title, Description?, OpensAtUtc, ClosesAtUtc, DurationMinutes, WrongAnswerPenaltyPercent, IsPublished, CreatedAtUtc, UpdatedAtUtc | Aggregate root for its Questions/Options. |
| **QuizClassRoom** | QuizId, ClassRoomId | A quiz can target several classes (10A and 10B are the same grade). |
| **Question** | Id, QuizId, Order, Text, Points | Owned by Quiz. |
| **Option** | Id, QuestionId, Order, Text, IsCorrect | Owned by Question. |
| **QuizAttempt** | Id, QuizId, StudentId, StartedAtUtc, DeadlineUtc, Status (`InProgress`/`Submitted`/`Expired`), FinalizedAtUtc?, Score?, MaxScore, CorrectCount?, WrongCount?, UnansweredCount?, Version | Unique (QuizId, StudentId). MaxScore snapshot at start. |
| **AttemptAnswer** | Id, AttemptId, QuestionId, SelectedOptionId?, AnsweredAtUtc | Unique (AttemptId, QuestionId). Null option = student cleared the answer. |

## Validation limits
- Quiz title 3–200 chars; description ≤ 1000; duration 1–180 minutes; penalty 0–100 (integer percent); `ClosesAtUtc > OpensAtUtc`; at least one class.
- Question text 1–2000 chars; points 1–100 (integer); 2–6 options (UI defaults to 4); **exactly one** correct option; ≤ 100 questions per quiz.
- Option text 1–500 chars.
- A draft may be saved with 0 questions. **Publishing** additionally requires ≥ 1 question and `ClosesAtUtc` in the future.

## Quiz availability
- `IsOpenAt(now)`: `IsPublished && OpensAtUtc <= now && now < ClosesAtUtc` (open is inclusive, close exclusive).
- Students only ever see quizzes that are **published** and **assigned to their class**. Anything else is 404 to them.
- Teacher-side derived state: `Draft` (not published) → `Scheduled` (now < opens) → `Open` → `Closed` (now ≥ closes).
- `IsLocked` = the quiz has at least one attempt.

## Editing rules (fairness)
- Only the owning teacher can see or change a quiz (others get 404).
- While **not locked**: everything can change (full replace of questions/options on save), including publish/unpublish and delete.
- Once **locked** (attempts exist and `now <= ClosesAtUtc`): nothing can change (409 `quiz.locked`). Unpublish and delete → 409 `quiz.has_attempts` (also after the close).
- **After the close** (`now > ClosesAtUtc`, attempts exist; added 24 Sep): the owner may change title, description, questions, options, the correct option, points, the marking and score visibility. `OpensAt`, `ClosesAt`, duration and classes must stay as stored (409 `quiz.locked` otherwise). The same transaction and save **regrade every attempt** (`QuizAttempt.Regrade`): an in-progress attempt (necessarily past its deadline) is finalized as Expired first; status, times and selected options never change; score, max and counts are recomputed; `RegradedAtUtc` records a changed result.
- **Identity on save:** questions and options sent with their `id` are updated in place. One without a known id is new. A current one that is not sent is deleted when the quiz has no attempts, and only marked `RemovedAtUtc` when it has (its answers stay readable; removed items are never shown to students or scored). An answer whose chosen option was removed counts as unanswered.

## Attempt timing
```
DeadlineUtc = min(StartedAtUtc + DurationMinutes, Quiz.ClosesAtUtc)
```
Example: quiz open 09:00–12:00, duration 20 min. Start at 10:00 → deadline 10:20. Start at 11:50 → deadline 12:00 (10 minutes). The student list/start screen shows `effectiveMinutesIfStartedNow` so the student is warned **before** starting.

## Attempt lifecycle
```
            start (first time)                    submit ≤ deadline
  (none) ───────────────────────► InProgress ───────────────────────────► Submitted
                                     │
                                     │ any request after deadline
                                     │ (lazy finalization)            
                                     └──────────────────────────────────► Expired
```
Both `Submitted` and `Expired` are **finalized**: Score, counts and FinalizedAtUtc are set once and never change.

### Start (`POST /api/student/quizzes/{quizId}/attempt`)
Order of checks:
1. Quiz exists, is published, and is assigned to the student's class — else 404.
2. If the student already has an attempt for this quiz:
   - finalized → 409 `attempt.already_taken`;
   - in progress but past deadline → finalize it as `Expired`, then 409 `attempt.already_taken`;
   - in progress and still running → **return the same attempt (200)** with saved answers (resume after refresh, phone lock, or another device).
3. `now < OpensAtUtc` → 409 `quiz.not_open_yet`; `now >= ClosesAtUtc` → 409 `quiz.closed`.
4. Create the attempt with `DeadlineUtc` from the formula and `MaxScore = sum(points)` → 201.
5. If `SaveChanges` hits the unique (QuizId, StudentId) violation (two taps / two tabs at once), reload the existing attempt and return it (200). Never produce two attempts, never return 500.

### Save answer

**No post-deadline grace:** an answer mutation is accepted only when `now <= DeadlineUtc`. If `now > DeadlineUtc`, finalize the attempt as `Expired` from answers already persisted, then reject the answer write. Client/request timestamps are never trusted to extend the deadline.
 (`PUT /api/student/attempts/{attemptId}/answers/{questionId}`)
1. Attempt exists and belongs to the current student — else 404.
2. Run lazy finalization. If the attempt is now finalized: 409 `attempt.deadline_passed` if it just expired in this request, otherwise 409 `attempt.not_in_progress`.
3. Question must belong to the attempt's quiz, and the option (when not null) must belong to that question — else 400 `answer.invalid_option`.
4. Upsert the AttemptAnswer (last write wins), bump `Version`.

### Submit (`POST /api/student/attempts/{attemptId}/submit`)
1. Attempt belongs to the student — else 404.
2. Already finalized → return the existing result (200). Submit is **idempotent**.
3. `now <= DeadlineUtc` → `Submitted`, `FinalizedAtUtc = now`.
   Otherwise → `Expired`, `FinalizedAtUtc = DeadlineUtc`. A late submit is **not** rejected: the student keeps what was already saved.
4. Score from the stored answers (the request has no body; anything the client sends is ignored).

### Lazy finalization (no background job)
`AttemptFinalizer.FinalizeIfExpired(attempt, now)`: if `InProgress` and `now > DeadlineUtc` → compute score from saved answers, set `Expired`, `FinalizedAtUtc = DeadlineUtc`. It is called by: start, get attempt, save answer, submit, student quiz list, teacher results. So an abandoned attempt is finalized the next time anyone looks at it, and the stored result is identical to what a job would have produced. Closing the browser is **not** a submission.

## Scoring
Per question (`p` = question points; the quiz charges either `k` = WrongAnswerPenaltyPercent, or a fixed `f` = WrongAnswerPenaltyPoints, then `k` = 0):
| Answer | Points |
|---|---|
| correct | `+p` |
| wrong | `−p × k / 100`, or `−min(f, p)` with a fixed mark |
| unanswered (no row or null option) | `0` |

`Score = Σ` of the above, rounded to **2 decimals** (`MidpointRounding.AwayFromZero`). **Never below 0** (changed on 24 Sep; it used to be unclamped): `Score = max(0, rounded Σ)`. `MaxScore = Σ p`. `Percentage = Score / MaxScore × 100`, rounded to 1 decimal.

Worked examples (penalty 25 %, questions worth 4, 2, 2, 1 → max 9):
- correct, wrong, unanswered, wrong → `4 − 0.5 + 0 − 0.25 = 3.25` → 36.1 %
- same answers with penalty 0 % → `4` → 44.4 %
- all four wrong with penalty 50 % → `−2 − 1 − 1 − 0.5 = −4.5` → **0** (the floor), 0 %
- same answers as the first example with a fixed mark of 1.5 → `4 − 1.5 − 1 = 1.5` (the 1-point question loses only 1)

`QuizScoring.Explain(questions, answers, penalty)` is a pure function in Domain and the **only** place scores are computed: it returns each question's earned points, deduction and contribution plus the total. Finalization, regrading, the seeder and the teacher's answer view all use it, so a stored result always equals the sum shown question by question (floored at 0).

## Student-facing statuses (quiz list)
| Status | Condition |
|---|---|
| `Upcoming` | now < OpensAtUtc, no attempt |
| `Available` | open now, no attempt |
| `InProgress` | attempt in progress and not past deadline |
| `Completed` | attempt finalized (Submitted or Expired) |
| `Missed` | now ≥ ClosesAtUtc and no attempt |

## Teacher results statuses (per assigned student)
`NotStarted` (quiz still open/upcoming, no attempt) · `InProgress` · `Submitted` · `Expired` · `Missed` (closed, no attempt).
Summary: assigned, started, finalized, average / highest / lowest score and average percentage over **finalized** attempts only.

## What a student may see
- During the attempt: question text, points, options (id + text), their own selections, deadline, server time. **Never** `IsCorrect`.
- After finalization: score, max, percentage, correct/wrong/unanswered counts, status, **unless the teacher hides scores**: then every student response carries `scoreVisible: false` and no graded value at all (read live from the quiz, never copied into the attempt). The teacher always sees everything.
- Correct answers per question: only once the quiz has **closed** (stretch S2), so answers don't leak to classmates who haven't taken it yet.

## Concurrency
- One attempt per student per quiz: guaranteed by the unique index; the start handler converts the violation into "return the existing attempt".
- `QuizAttempt.Version` is a concurrency token incremented by every answer save and by finalization. If `DbUpdateConcurrencyException` occurs, reload and re-evaluate once (e.g. an answer save racing a submit ends as 409 `attempt.not_in_progress` instead of a lost write).
- Finalization is idempotent: finalizing an already-finalized attempt is a no-op.
