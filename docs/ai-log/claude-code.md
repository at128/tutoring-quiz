# AI log — Claude Code

Append one entry per milestone:

```
### <milestone> — <date/time>
Asked to: …
Did: …
Unsure about / assumptions: …
Human changed or rejected: …
```

### M0 — 2026-09-23 evening
Asked to: scaffold the solution, frontend, Docker and CI (PLAN.md → M0); Atta asked me to work without routine check-ins but to raise any deviation from the docs before making it.
Did: `git init` + planning commit (Atta asked me to); 4 src + 2 test projects with the documented references, `Directory.Build.props` (warnings as errors for `src/`), central package versions, `global.json`; Api health endpoint, ProblemDetails exception handler skeleton, `/api/*` ProblemDetails 404 before the SPA fallback, `TimeProvider.System`, JSON defaults (string enums, unescaped Arabic); Vite React TS app with Tailwind v4 and the `/api` proxy; multi-stage Dockerfile, compose, CI (backend / frontend / docker jobs).
Checked: `dotnet build` → 0 warnings, 0 errors · `dotnet test` → 1 passed · `npm run build` and `npm run lint` → green · `docker compose up --build` → `/api/health` returned `{"status":"ok"}`, a client route served `index.html`, `/api/nope` returned a `application/problem+json` 404 with `code: not_found`. CI not observed yet (nothing pushed).
Unsure about / assumptions: `global.json` pins `9.0.100` + `latestFeature` so any 9.0 SDK (local 9.0.317, Docker `sdk:9.0`, CI via setup-dotnet) is accepted. No compose healthcheck: the aspnet image has no curl/wget.
Human changed or rejected: stay on .NET 9 (no .NET 10 SDK installed); keep the template's oxlint instead of ESLint (docs updated); from now on, Docker builds and integration tests are postponed until the whole app is built — fast checks only (build, domain tests, frontend build/lint) during milestones.

### B1 — 2026-09-23 evening
Asked to: domain, persistence, auth and seed (PLAN.md → B1). Atta added: Application layer strictly SOLID, functional core / imperative shell, small steps, every failure path handled.
Did: Domain entities with invariants (`Quiz` aggregate with full-replace content, publish/unpublish/lock rules; `QuizAttempt` with start/save/submit/lazy finalization and a `Version` token), `QuizRules` (validation limits with API field keys), `QuizScoring`, `AttemptTiming`, `DomainException` + `ErrorCodes`. Application: `IAppDbContext` (aggregate roots only), `ICurrentUser`, `IPasswordHasher`, AppException types, pure `FieldErrors` validators, Login/GetCurrentUser handlers. Infrastructure: EF Core SQLite with UTC converter, enums as strings, all documented unique indexes, `ValueGeneratedNever` Guid v7 keys, SQLite 2067 → `DuplicateKeyException`, initial migration, PBKDF2 hasher, seeder (BCL `TextFieldParser` CSV with BOM, JSON with nullable/required checks, fail-fast file/line messages, deterministic demo attempts through domain methods). Api: cookie auth (`tq.auth`, HttpOnly, SameSite=Strict, SameAsRequest, sliding 8 h) with 401/403 ProblemDetails, fixed-window login limiter (configurable, default 10/min), single error catalogue code → status, model-binding errors as `validation_failed`.
Checked: `dotnet build` → 0 warnings · `dotnet test` (domain) → 17 passed (D1–D11 + extras) · manual run on a temp DB: seeded 3 classes / 4 teachers / 60 students / 5 quizzes / 36 demo attempts; `10A-01` logs in (case-insensitive), Arabic names unescaped, wrong password → 401 `auth.invalid_credentials`, `{}` → 400 with field errors, malformed JSON → 400, anonymous `/me` → 401 ProblemDetails, cookie `httponly; samesite=strict`.
Not done (postponed by Atta): integration tests I9 and I15, Docker run.
Unsure about / assumptions: added `PRAGMA journal_mode=WAL` at startup and optional Data Protection key persistence on the data volume (`DataProtection__KeysPath`) so a container restart doesn't sign students out; seed quizzes are "published" at a simulated time 2 days before opening so closed demo quizzes pass the domain publish rule; `Options/` folder from ARCHITECTURE.md not created because no application options exist once the answer grace was removed.
Human changed or rejected: —
