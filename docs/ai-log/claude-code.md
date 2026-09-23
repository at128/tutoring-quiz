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
