# Testing strategy

Test the rules that would hurt Nour if they broke — one attempt per student, time limits, scoring, who can see what — not CRUD plumbing. Tests are named after behaviour: `Start_WhenStudentAlreadySubmitted_Returns409AlreadyTaken`.

## Infrastructure rules
- **Never use the EF Core InMemory provider.** It doesn't enforce unique indexes, so the one-attempt test would pass while testing nothing.
- Integration tests use `WebApplicationFactory<Program>` with environment `Testing`, and a **temporary SQLite file per test class** (`Path.GetTempPath()/tq-{guid}.db`, deleted on dispose). A file (not `:memory:` on one shared connection) is required so concurrent requests use separate connections, like production. Apply migrations with `MigrateAsync()` so the migrations are tested too.
- Replace `TimeProvider` with `FakeTimeProvider` (package `Microsoft.Extensions.TimeProvider.Testing`) registered as a singleton; tests move time with `Advance(...)`/`SetUtcNow(...)`. No `Thread.Sleep`/`Task.Delay` to test time.
- Demo seeding is disabled in `Testing`. Each test builds its own small data set through a `TestData` builder (one class, one teacher, a few students, a quiz with 3–4 questions with known points and penalty) written directly through the DbContext.
- Helper `LoginAsync(client, username, password)`; clients keep cookies. For "two tabs" scenarios, log two clients in as the same student.
- xUnit asserts only (no FluentAssertions).
- Frontend: `npm run lint`, `npm run typecheck`, the Vitest unit tests (answers/autosave, timer, server clock, editor validation, results sorting, the Arabic interface and its dictionaries) and `npm run build` are the gate. Browser journeys are Playwright tests (below), run in CI.

## Required tests
### Domain (`TutoringQuiz.Domain.Tests`) — pure, fast
| # | Test |
|---|---|
| D1 | No penalty: only correct answers count; wrong and unanswered give 0 |
| D2 | With penalty: the worked example in DOMAIN.md (4,2,2,1 / 25 %) gives 3.25 |
| D3 | Unanswered is 0 even with penalty (missing row and null option both) |
| D4 | The total never goes below 0: the −4.5 example scores 0 (changed on 24 Sep; it was unclamped) |
| D5 | Rounding to 2 decimals, away from zero (e.g. 33 % of 1 point) |
| D6 | Deadline = start + duration when the close time is later |
| D7 | Deadline = close time when starting near the close |
| D8 | IsOpenAt boundaries: exactly at open → open; exactly at close → closed |
| D9 | Answer save at/before deadline is allowed; answer save after deadline is rejected and cannot affect score |
| D10 | Finalize is idempotent; late finalization gives Expired with FinalizedAt = deadline |
| D11 | Publish validation: no questions / zero or two correct options / close time in the past → rejected |

### Integration (`TutoringQuiz.Api.IntegrationTests`) — the top 10 are marked ★
| # | Test |
|---|---|
| I1 ★ | Start twice after submitting → 409 `attempt.already_taken`; still exactly one row |
| I2 ★ | Start while in progress → 200 with the **same** attempt id and the saved answers (resume) |
| I3 ★ | Two concurrent starts (two clients, `Task.WhenAll`) → one attempt row, both responses carry the same id, no 500 |
| I4 ★ | Start before open → 409 `quiz.not_open_yet`; at/after close → 409 `quiz.closed` |
| I5 ★ | Student AttemptView raw JSON contains no `isCorrect` (assert on the string) |
| I6 ★ | Save answer with an option from another question → 400; question from another quiz → 400; another student's attempt → 404 |
| I7 ★ | Save after deadline → 409 `attempt.deadline_passed`, attempt becomes Expired, and the late answer is not persisted; late submit → 200 Expired with score from answers saved before the deadline |
| I8 ★ | Score is server-computed: known answers with 25 % penalty give the expected score; a `score` field sent in the submit body is ignored |
| I9 ★ | Roles: student → teacher endpoint 403; teacher → student endpoint 403; anonymous → 401 (ProblemDetails, not a redirect) |
| I10 ★ | Teacher B can't read, edit, publish or see results of Teacher A's quiz → 404 |
| I11 | Student can't see or start an unpublished quiz or a quiz for another class → 404 |
| I12 | Quiz with an attempt: PUT → 409 `quiz.locked`; unpublish/delete → 409 `quiz.has_attempts` |
| I13 | Arabic round-trip: teacher creates a quiz with Arabic title/questions/options; student reads identical strings |
| I14 | Teacher results include NotStarted/Missed rows and lazily finalize an abandoned attempt |
| I15 | Login: valid → cookie is HttpOnly; invalid → 401 `auth.invalid_credentials`; username is case-insensitive |
| I16 | Submit is idempotent: second submit returns the same result |

### Added on 24 Sep with the teacher controls
| Tests | What they pin down |
|---|---|
| `QuizScoringTests`, `WrongAnswerPenaltyRulesTests`, `FixedDeductionTests` | a fixed mark per wrong answer, capped at the question's points; validation; the zero floor |
| `ScoreFloorMigrationTests` | stored negative totals are raised to 0 by the migration (migrate down and up) |
| `ClosedQuizRegradeTests`, `QuizRegradeDomainTests` (Codex) | edits refused while open, allowed after the close; every attempt regraded atomically (answer key, points, marking, added and removed questions, removed chosen options); statuses, times and selections unchanged; ids kept |
| `TeacherAttemptDetailTests` (Codex) | the teacher's answer view: selected and correct options, outcomes, points and deductions, agreement with the results row; 404 for another teacher |
| `ScoreVisibilityTests` (Codex) | hidden scores are absent from every student response (result, submit, attempt view, quiz list), live toggling, the teacher still sees everything, existing quizzes default to visible |
| `editorIdentity.test.ts`, `marking.test.ts` | the editor sends question/option ids and the visibility flag; fixed-mark parsing (including ٠٫٥) and validation; marking texts |

### Browser end-to-end (`frontend/e2e`, Playwright) — added 24 Sep at Atta's request
Run in CI against the real Docker container (`npm run test:e2e`, base URL `E2E_BASE_URL`, default `http://127.0.0.1:18081`):
- Arabic phone (360 px, `ar-JO`): the device language picks Arabic and right-to-left, the language button switches and is remembered, sign-in, autosave, reload keeps the answer, submit, result; no horizontal scroll.
- English desktop: the same journey, and submit waiting for a delayed save followed by a cleared answer (the server scores the cleared answer).
- Arabic teacher: creates and publishes an Arabic quiz on a phone, a student takes it, the teacher sees the result.
- Arabic editor: a title, question or option made only of tatweel, diacritics or invisible marks is refused with Arabic messages.

## Manual checks before submission (human)
- Real phone on the LAN (`http://<laptop-ip>:8080`): log in, take the Arabic quiz, lock the phone for a minute, unlock, answers and time still right, submit.
- Refresh mid-quiz; open the same quiz in a second tab; try to start again after submitting.
- Teacher: create a quiz with an Arabic question, publish, take it as a student, view results.
- Fresh clone in a new folder → `docker compose up --build` → log in with README credentials.
