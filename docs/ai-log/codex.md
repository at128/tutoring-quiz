# AI log — Codex

Append one entry per milestone:

```
### <milestone> — <date/time>
Asked to: …
Did: …
Unsure about / assumptions: …
Human changed or rejected: …
```

### F1 takeover — 2026-09-23 evening
Asked to: take over implementation after Claude Code reached its limit; preserve the F1 work in progress and prioritize clear, correct Application logic and failure paths.
Did: read the project contracts and current Domain/Application/Infrastructure/API code; completed the inherited F1 auth shell and student quiz list by fixing sign-out failure handling and the root route's session-check error state.
Checked: `npm run build` and `npm run lint` passed; a temporary seeded SQLite API run returned the expected student quiz list, with 401 for anonymous and 403 for a teacher on the student endpoint. A headless browser screenshot could not be produced in this environment, so the 360 px visual check remains for a real browser/phone.
Unsure about / assumptions: the existing F1 files were authored by Claude Code before the handoff; the fixes above and verification were performed by Codex. The locked API contract and product decisions were not changed.
Human changed or rejected: Atta transferred implementation ownership from Claude Code to Codex after Claude reached its limit.

### B2 student attempt API — 2026-09-23 evening
Asked to: continue the implementation with SOLID boundaries, a functional core, explicit failure handling, and edge-case coverage.
Did: implemented the student start/resume, attempt view, answer save/clear, submit, and result use cases; kept authorization and time/score decisions on the server; added thin API routes and explicit response projections. Reused the existing domain timing/scoring and concurrency-token infrastructure. Added isolated file-backed SQLite integration tests for B2 plus login/role checks.
Checked: `dotnet test tests/TutoringQuiz.Api.IntegrationTests/TutoringQuiz.Api.IntegrationTests.csproj` passed 17/17, including concurrent start, ownership, no answer-key leakage, deadline boundary, late answer rejection, scoring, idempotent submit, and cookie contract. The test factory now uses a unique temporary SQLite file, disables demo seeding, and injects a fake clock.
Unsure about / assumptions: student-to-teacher role coverage needs a teacher route from B3; real-phone and Docker acceptance remain separate checks. No API contract changes were made.
Human changed or rejected: no additional direction during B2.

### B3 backend and end-to-end HTTP coverage — 2026-09-23 evening
Asked to: stop frontend work, complete the backend, and test full workflows and failure/edge cases. The unfinished F2 drafts were left uncommitted and untouched during this backend milestone.
Did: implemented teacher classroom/list/get/create/update/publish/unpublish/delete/results endpoints with separate Application handlers, pure view/result policies, central request-shape validation, ownership checks, and lazy result finalization. Added serialized write transactions around student start, save and submit, and teacher mutations to protect deadlines and lock rules during races. Kept published quizzes from becoming questionless, corrected draft result status, and made the deadline calculation safe near the maximum date.
Checked: `dotnet test TutoringQuiz.sln -c Release` passed 60/60 (20 Domain, 40 SQLite HTTP integration); repeated the edit/start, answer/save and answer/submit races five times each without failure. A fresh seeded test database migrated and produced 60 students, 4 teachers, 5 quizzes and demo attempts; both roles logged in and read their data. `dotnet publish` for the API succeeded in Release.
Unsure about / assumptions: no frontend, browser or full Docker-image acceptance was claimed in this backend milestone. The API contract was not changed. Treating unpublished drafts as `NotStarted`, not `Missed`, in teacher results is a result-policy interpretation consistent with their `Draft` state.
Human changed or rejected: Atta requested backend-only work and said the frontend designed in Claude would be transferred later.

### Backend/frontend handler audit — 2026-09-24
Asked to: audit every backend handler and frontend workflow with edge-case tests, without disrupting Claude's concurrent F3 UI work.
Did: reviewed all 17 Application handlers and current frontend logic; added 26-request teacher validation boundary coverage, API-client and auth-navigation tests, and a live student quiz-status projection with boundary/order tests. A failing role-prefix redirect test led to a narrow navigation fix. Left Claude's dirty F3 files untouched and recorded remaining F3 findings in `docs/reviews/backend-frontend-handler-audit-codex-review.md`.
Checked: 71 backend tests passed, 47 frontend tests passed at the last full frontend run, frontend typecheck/lint/build passed. Docker and real-browser journeys were not run.
Unsure about / assumptions: teacher F3 files were still changing during inspection, so their final implementation needs a fresh pass. No API contract change was made.
Human changed or rejected: no additional direction during this audit.

### M4 adversarial review — 2026-09-24
Asked to: coordinate with Claude while he tests/translates the whole Arabic UI, and independently review the repository for remaining edge cases.
Did: wrote `docs/reviews/M4-codex-adversarial.md` after checking backend rules, authorization, persistence, runtime configuration, teacher/student flows and relevant tests. Reported four concrete findings for human triage; made no implementation edits during the review. Claude's Arabic UI changes were in progress and excluded from sign-off.
Checked: `dotnet test TutoringQuiz.sln -c Release --no-restore --no-build` passed 78 tests (20 Domain, 58 HTTP/SQLite). Docker and browser journeys were not rerun in this review.
Unsure about / assumptions: the cross-origin form risk assumes an untrusted sibling origin on the same site and a known quiz/attempt ID; Atta should assess deployment trust before triage.
Human changed or rejected: Atta approved the full Arabic UI and browser E2E tests in CI via Claude's coordination message; implementation follows the review and is not claimed here.
