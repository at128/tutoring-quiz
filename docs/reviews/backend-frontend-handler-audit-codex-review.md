# Backend and frontend handler/workflow audit — Codex (2026-09-24)

Scope checked: all 17 Application handlers, their shared access/finalization/projection policies, API controllers, the current student and teacher frontend logic, and the automated tests. The teacher F3 files were changing concurrently; this is a snapshot, not a sign-off on their final version. No API contract was changed.

## Backend handler coverage

| Handler | Exercised outcomes and edges |
|---|---|
| `LoginHandler` | Valid/case-insensitive credentials, bad password, unknown user, blank/oversized fields, cookie and login rate limit (`AuthContractTests`). |
| `GetCurrentUserHandler` | Student/teacher projections, no session, logout, stale cookie after user deletion (`AuthContractTests`). |
| `ListStudentQuizzesHandler` | Visibility, all five statuses and order, effective time, lazy expiry (`AttemptFlowTests`). |
| `StartAttemptHandler` | New/resume, simultaneous starts, opening/closing boundaries, unassigned/unpublished quiz, already submitted, and lazy expiry persisted before `already_taken` (`AttemptFlowTests`). |
| `GetAttemptHandler` | Owner isolation, in-progress answer-key secrecy, exact deadline and lazy expiry, final view without questions (`AttemptFlowTests`). |
| `SaveAnswerHandler` | Missing/null body values, invalid question/option, owner isolation, upsert and clear, deadline boundary and late rejection, submitted rejection, concurrent saves and save/submit race (`AttemptFlowTests`). |
| `SubmitAttemptHandler` | Server-computed positive/negative scores, forged body ignored, late expiry from saved answers, idempotency, owner isolation and save/submit race (`AttemptFlowTests`, `TeacherWorkflowTests`). |
| `GetAttemptResultHandler` | In-progress conflict, owner isolation, finalized result and direct lazy expiry (`AttemptFlowTests`). |
| `ListClassRoomsHandler` | Teacher-only access and class student counts (`TeacherWorkflowTests`). |
| `ListTeacherQuizzesHandler` | Teacher ownership filter, all four state groups, assigned/started/finalized counts and lock flag (`TeacherWorkflowTests`). |
| `GetTeacherQuizHandler` | Owner/other-teacher isolation, draft content, published and locked views (`TeacherWorkflowTests`). |
| `CreateTeacherQuizHandler` | Arabic round trip, valid draft, unknown class, missing fields and 26 documented invalid boundary cases with no partial persistence (`TeacherWorkflowTests`, `TeacherValidationBoundaryTests`). |
| `UpdateTeacherQuizHandler` | Full replacement and repeat update, published nonempty rule, class reassignment, lock after attempt and edit/start race (`TeacherWorkflowTests`). |
| `PublishTeacherQuizHandler` | Success, idempotency, empty questions, close in past and ownership (`TeacherWorkflowTests`). |
| `UnpublishTeacherQuizHandler` | Success, idempotency, lock after attempt, ownership and unpublish/start race (`TeacherWorkflowTests`). |
| `DeleteTeacherQuizHandler` | Success, blocked after attempt and ownership (`TeacherWorkflowTests`). |
| `GetQuizResultsHandler` | No scores/null statistics, in-progress rows, multi-class positive/negative aggregation, lazy expiry, missed vs draft-not-started and ownership (`TeacherWorkflowTests`). |

The previously found `StartAttemptHandler` rollback defect is fixed in commit `0af2c86` and has a regression test: an expired attempt is stored as `Expired` before the `409 attempt.already_taken` response. The new boundary suite exercises 26 invalid create requests in one integration test. HTTP tests use migrated file-backed SQLite and a fake server clock.

## Frontend coverage and changes made without touching Claude's dirty files

- Existing tests cover answer reducer transitions, timer thresholds/backoff, server clock helpers, editor form mapping/validation, and teacher results sorting/filtering.
- New `api/client.test.ts` checks cookie/JSON requests, 204 responses, ProblemDetails, session 401 handling, network/abort behavior and malformed JSON. New `auth/navigation.test.ts` checks safe role redirects; a role-prefix bug was fixed in `auth/navigation.ts` after a failing regression test.
- New `liveQuiz.ts` and tests derive opening/closing transitions and re-sort cards while a student page remains open. Only the previously clean `QuizListPage.tsx` and `StartQuizPage.tsx` were wired to it.
- The active teacher F3 source files, routes, `studentQuizCopy.ts`, `time.ts`, `format.ts`, package manifests and design components were not modified by Codex.

## Findings and remaining verification

| ID | Severity | Where | Concrete scenario | Suggested resolution |
|---|---|---|---|---|
| HF-01 | major | `frontend/src/features/teacher/QuizListPage.tsx` | Leave the teacher list open across a scheduled quiz's opening or an open quiz's closing. The API-derived `state` badge and order remain stale even though the clock updates, until a refetch. | Derive time states live or schedule a refetch at the next boundary; test both exact instants. This file is currently Claude-owned/dirty, so Codex did not edit it. |
| HF-02 | major | `frontend/src/features/teacher/editor/editorForm.ts:56` | In Jerusalem time, entering nonexistent local time `2026-03-27T02:30` is silently converted by `Date` to `03:30`; even `2026-02-30T10:00` becomes March 2 instead of failing validation. A teacher could save a different time than entered. | Round-trip-check the local fields before accepting an instant, and test spring DST gaps and invalid calendar dates. This file is currently Claude-owned/dirty, so Codex did not edit it. |
| HF-03 | major (test gap) | `frontend/package.json`, `frontend/src/features/**` | The 47 frontend tests are pure/client tests; there is no browser or DOM workflow test for login → start → autosave/offline/refresh → submit/result, or teacher create → publish → results. Unit and HTTP suites can pass while a button/navigation flow is broken. | After Claude finishes F3 package edits, add a browser/DOM test harness and run critical journeys at phone and desktop widths. Do not modify the active package files concurrently. |

Checks observed in this session: `dotnet test TutoringQuiz.sln -c Release --no-restore` — 71 passed (20 Domain, 51 HTTP/SQLite); `npm test -- --run` — 47 passed at the last full frontend run; `npm run typecheck`, `npm run lint`, and `npm run build` passed. The Vite build emitted a non-failing >500 kB chunk warning. Docker image startup, real browser interactions and real-phone layout have **not** been verified in this audit. "All possible failures" cannot be proved by a finite suite; the table covers identified contract branches and high-risk races.
