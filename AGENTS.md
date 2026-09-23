# AGENTS.md — shared instructions for implementation and review

This repository is a 24-hour practical assessment for byThursday: an online quiz platform for Nour's tutoring centre in Amman (~300 students, 12 teachers).

**Claude Code is the primary implementer** for backend, frontend, tests, runtime and CI. **OpenAI Codex is the independent reviewer** at checkpoints and during final adversarial review. The human (Atta) owns scope, architecture, acceptance/rejection of findings, pushes and submission.

## Source of truth (read what the current task needs)
- `docs/BRIEF.md` — client brief + assessment requirements
- `docs/ARCHITECTURE.md` — Clean Architecture layout, dependency rules, conventions, runtime
- `docs/DOMAIN.md` — entities, business rules, formulas, attempt lifecycle
- `docs/API.md` — locked HTTP contract; changes need human approval
- `docs/FRONTEND.md` — routes, UX rules, mobile + Arabic requirements, visual direction
- `docs/TESTING.md` — test strategy and required tests
- `docs/SEED_DATA.md` — sample data loading and demo accounts
- `docs/WORKFLOW.md` — primary-implementer / independent-review workflow
- `PLAN.md` — milestones, acceptance criteria, out-of-scope list
- `DECISIONS.md` — locked product/architecture decisions. Do not silently re-open them.

## Ownership / modes
| Mode | Agent | Allowed paths |
|---|---|---|
| Implementation | Claude Code | `src/**`, `tests/**`, `frontend/**`, runtime/CI files, seed files when approved, and requested doc drafts |
| API contract changes | Claude Code proposes; human approves | `docs/API.md` |
| Checkpoint/final review | Codex | read entire repo; may only create/update the assigned `docs/reviews/**` report |
| Deliverable finalization | Human | `README.md`, `DECISIONS.md`, `AI_USAGE.md` (agents may draft when asked) |
| AI work log | corresponding tool | `docs/ai-log/claude-code.md`, `docs/ai-log/codex.md` |

Codex review mode is read-only except for the review report. It must not “fix while reviewing.” Claude Code implements accepted fixes only after human triage.

## Non-negotiable rules
1. One implementation milestone at a time (see `PLAN.md`). Stop at the end and report. Do not start the next milestone unasked.
2. Stay in scope. Do not add features, libraries, projects or layers that the docs do not describe. If something important seems missing, report it instead of silently building it.
3. The server is authoritative for identity, role, eligibility, time, deadlines and scores. Never trust ids, times or scores supplied by the client.
4. `isCorrect` / correct-option data must never appear in a student-facing response while an attempt is in progress.
5. All times are UTC. Backend code gets “now” only from injected `TimeProvider` — never `DateTime.Now` / `UtcNow` in Domain or Application.
6. **No answer grace after deadline.** An answer save is valid only when `now <= DeadlineUtc`. A request after the deadline must not add/change an answer that can affect score. Late submit finalizes from answers already saved before the deadline.
7. Honesty: never claim build/test success unless you ran it in this session and observed it. If something could not be run, say so.
8. Never disable, skip or weaken a test to make it pass. Fix the cause or report it.
9. No secrets or generated SQLite DB files in git.
10. Add dependencies with the package tools (`dotnet add package`, `npm install`) so versions are real; pin .NET versions centrally. Do not use MediatR, AutoMapper or FluentAssertions because they add ceremony/dependency surface without improving this assessment's correctness; use direct use cases / `IAppDbContext` and xUnit asserts.
11. Arabic must work: UTF-8 everywhere; never assume user-entered text is LTR.

## Commands
Backend (repo root):
- `dotnet build` · `dotnet test`
- `dotnet run --project src/TutoringQuiz.Api` → http://localhost:5080
- migration: `dotnet ef migrations add <Name> --project src/TutoringQuiz.Infrastructure --startup-project src/TutoringQuiz.Api`

Frontend (`frontend/`):
- `npm ci` · `npm run dev` (http://localhost:5173, proxies `/api` to http://localhost:5080) · `npm run build` · `npm run lint`

Whole app:
- `docker compose up --build` → http://localhost:8080
- reset all data: `docker compose down -v`

## Definition of done (every implementation milestone)
- Builds with zero errors; any new warning is explained.
- Required tests exist and pass (`dotnet test`; frontend `npm run build` and `npm run lint`).
- Behaviour matches docs; every deviation is listed in the report.
- Work is committed in small logical Conventional Commits (`feat(api): …`, `test(domain): …`, `feat(web): …`, `fix(api): …`). No `wip`, `fix2`, `final`.
- Claude Code never pushes, merges, rebases or rewrites history; the human does that.
- Claude Code appends a short factual entry to `docs/ai-log/claude-code.md`.

## Implementation report format
```text
## Report — <milestone id>
Done:
- …
Not done / deviations from docs:
- … (or “none”)
Commands run → result:
- dotnet test → 34 passed, 0 failed
Human should check:
- path/File.cs:42 — why
Proposed next step: …
```

## Review mode (Codex)
When asked to review:
- Do not modify implementation code.
- Review the specified diff **and read full files where context is needed**.
- Check backend, frontend, tests, runtime and docs relevant to the checkpoint.
- Prioritize correctness, security, races/data loss, deadline/score manipulation, mobile failures, Arabic rendering and clean-machine startup over style.
- Write one report to `docs/reviews/<checkpoint>-codex-review.md` using the format in `docs/WORKFLOW.md`.
- Give every finding a concrete failing scenario and severity.
- Also list what was checked and found correct.
- Append a short note to `docs/ai-log/codex.md` only if Codex actually performed the review.

## Roles
- **Claude Code** — primary implementer for the entire application on `main`.
- **Codex** — independent reviewer at C1/C2/C3 and M4; no implementation ownership unless the human explicitly changes the plan later.
- **Human** — scope/architecture owner, finding triage, pushes, final docs, submission.
