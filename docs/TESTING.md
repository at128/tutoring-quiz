# Testing strategy

Test the rules that would hurt Nour if they broke — one attempt per student, time limits, scoring, who can see what — not CRUD plumbing. Tests are named after behaviour: `Start_WhenStudentAlreadySubmitted_Returns409AlreadyTaken`.

## Infrastructure rules
- **Never use the EF Core InMemory provider.** It doesn't enforce unique indexes, so the one-attempt test would pass while testing nothing.
- Integration tests use `WebApplicationFactory<Program>` with environment `Testing`, and a **temporary SQLite file per test class** (`Path.GetTempPath()/tq-{guid}.db`, deleted on dispose). A file (not `:memory:` on one shared connection) is required so concurrent requests use separate connections, like production. Apply migrations with `MigrateAsync()` so the migrations are tested too.
- Replace `TimeProvider` with `FakeTimeProvider` (package `Microsoft.Extensions.TimeProvider.Testing`) registered as a singleton; tests move time with `Advance(...)`/`SetUtcNow(...)`. No `Thread.Sleep`/`Task.Delay` to test time.
- Demo seeding is disabled in `Testing`. Each test builds its own small data set through a `TestData` builder (one class, one teacher, a few students, a quiz with 3–4 questions with known points and penalty) written directly through the DbContext.
- Helper `LoginAsync(client, username, password)`; clients keep cookies. For "two tabs" scenarios, log two clients in as the same student.
- xUnit asserts only (no FluentAssertions).
- Frontend: `npm run build` (type-check) and `npm run lint` are the gate. A couple of Vitest unit tests for `lib/time.ts` (countdown with server offset) are welcome if cheap, not required.

## Required tests
### Domain (`TutoringQuiz.Domain.Tests`) — pure, fast
| # | Test |
|---|---|
| D1 | No penalty: only correct answers count; wrong and unanswered give 0 |
| D2 | With penalty: the worked example in DOMAIN.md (4,2,2,1 / 25 %) gives 3.25 |
| D3 | Unanswered is 0 even with penalty (missing row and null option both) |
| D4 | Total can go negative and is not clamped (the −4.5 example) |
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

## Manual checks before submission (human)
- Real phone on the LAN (`http://<laptop-ip>:8080`): log in, take the Arabic quiz, lock the phone for a minute, unlock, answers and time still right, submit.
- Refresh mid-quiz; open the same quiz in a second tab; try to start again after submitting.
- Teacher: create a quiz with an Arabic question, publish, take it as a student, view results.
- Fresh clone in a new folder → `docker compose up --build` → log in with README credentials.
