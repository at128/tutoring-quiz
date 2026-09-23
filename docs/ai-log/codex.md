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
