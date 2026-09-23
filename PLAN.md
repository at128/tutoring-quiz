# PLAN — milestones

Principle: **a complete, correct, explainable core flow beats feature count.** Priority when time is short: runs with one command → student flow → server-side rules → mobile UX → tests → teacher flow → docs → stretch.

Roles: **CC** = Claude Code, primary implementer for backend + frontend on `main` · **CX** = Codex, independent reviewer at checkpoints and M4 · **H** = human.

## Timeline (email received Wed 23 Sep 16:59 → due Thu 24 Sep 16:59)
| Block | Claude Code (implementation) | Codex | Human |
|---|---|---|---|
| Evening 1 | **M0** scaffold, Docker, CI | — | commit package, create repo, approve M0 |
| Evening 2 | **B1** domain/persistence/auth/seed → **F1** shell/login/API client | — | review, run app |
| Checkpoint | fixes accepted findings | **C1** independent full-stack review | triage, tag `cp1` |
| Evening 3 | **B2** attempt flow/tests → **F2** student flow | — | |
| Checkpoint | fixes accepted findings | **C2** independent full-stack review | triage, tag `cp2`, sleep |
| Morning 1 | **B3** teacher authoring/results → **F3** teacher pages | — | real-phone test |
| Checkpoint | fixes accepted findings | **C3** independent full-stack review | triage, tag `cp3` |
| Morning 2 | fixes accepted blockers/majors | **M4** adversarial whole-repo review | phone/manual checks |
| Midday | **M5** docs draft + clean-clone support | — | finalize docs and submission |

---

## M0 — Scaffold and runtime skeleton (CC)
Deliver:
- Toolchain check (`dotnet --list-sdks`, `node --version`, `docker --version`) → choose target framework per ARCHITECTURE.md.
- `TutoringQuiz.sln` with the 4 src projects and 2 test projects, correct references only, `Directory.Build.props`, `Directory.Packages.props`, `global.json`, `.gitignore` (dotnet + node + `*.db`), `.editorconfig`.
- Api: `GET /api/health`, ProblemDetails handler skeleton, static-file hosting + SPA fallback + `/api` 404 rule, `TimeProvider.System` registered.
- `frontend/` Vite React TS app: minimal placeholder page calling `/api/health`, Vite proxy to 5080, Tailwind installed.
- `Dockerfile`, `.dockerignore`, `docker-compose.yml` per ARCHITECTURE.md; `.github/workflows/ci.yml` targeting the actual `main` branch.
- One integration test: health returns 200.
Acceptance: `dotnet build` · `dotnet test` · `cd frontend && npm ci && npm run build && npm run lint` · `docker compose up --build` serves http://localhost:8080 and `/api/health` returns ok · CI green after human push.
Then H: `git tag cp0` and push the tag.

## B1 — Domain, persistence, auth, seed (CC)
- Domain entities and rules from DOMAIN.md, `QuizScoring`, `AttemptTiming`, `DomainException`. Tests **D1–D11**.
- `AppDbContext`, configurations (all indexes/constraints in ARCHITECTURE.md), UTC converter, initial migration.
- Cookie auth, `ICurrentUser`, login/logout/me, rate limiter, role policies, ProblemDetails `code`s.
- `DemoDataSeeder` per SEED_DATA.md (including demo attempts via `QuizScoring`).
- Tests: **I9**, **I15**.
Acceptance: `dotnet test` green; `docker compose up --build` then login as `10a-01` and `teacher.reem` works; DB contains 60 students, 4 teachers, 5 quizzes, demo attempts.

## F1 — App shell (CC)
- `api/types.ts` mirroring API.md, `api/client.ts` with ProblemDetails parsing and 401 handling.
- AuthProvider, RequireRole, role redirect, login page, logout, PageShell (mobile-first), design tokens/font per FRONTEND.md, `Auto` text component, not-found page.
- Student quiz list page against the real B1 API.
Acceptance: `npm run build` and `npm run lint` green; login → role home works against backend; no horizontal scroll at 360 px.

## C1 — checkpoint
Codex reviews `cp0..HEAD` across backend + frontend, writes one report, human triages, Claude fixes accepted findings, full checks run, then tag `cp1`.

## B2 — Student attempt flow (CC)
- List student quizzes, start (resume + race handling), get attempt, save answer, submit, result, `AttemptFinalizer`, `Version` concurrency token.
- **No post-deadline answer grace.** SaveAnswer accepts only when `now <= DeadlineUtc`. After deadline it finalizes as Expired and rejects the write. Late submit finalizes from already-saved answers.
- Tests **I1–I8**, **I11**, **I16**.
Acceptance: all green; manual API run start → answer → refresh → resume → submit.

## F2 — Student flow UI (CC)
- Start screen (effective-time warning), take-quiz page exactly as FRONTEND.md: server-clock timer, one question per screen, navigator, autosave with status + retry queue, submit confirmation, auto-submit at 0, resume, visibility resync, result page.
- Client never treats a post-deadline answer as valid; authoritative result comes from API.
Acceptance: build/lint green; full student journey at 360 px against backend, including refresh mid-quiz and Arabic quiz.

## C2 — checkpoint
Codex reviews `cp1..HEAD`, human triages, Claude fixes accepted findings, full checks, tag `cp2`.

## B3 — Teacher authoring and results (CC)
- Classrooms, list/get/create/update (full replace), publish/unpublish/delete, locking rules, results with lazy finalization and summary.
- Tests **I10**, **I12**, **I13**, **I14**.
Acceptance: tests green; a quiz created via API can be taken by a student and appears in results.

## F3 — Teacher UI (CC)
- My quizzes, quiz editor (React Hook Form, field arrays, server error mapping, locked read-only mode), publish/unpublish/delete, results page (tiles, filter, sort, table ↔ cards).
Acceptance: build/lint green; create an Arabic quiz at phone size, publish, take as student, view result as teacher.

## C3 — checkpoint
Codex reviews `cp2..HEAD`, human triages, Claude fixes accepted findings, full checks, tag `cp3`.

## M4 — Hardening
1. Codex runs a read-only adversarial review of the whole repository → `docs/reviews/M4-codex-adversarial.md`.
2. Human triages every finding.
3. Claude Code fixes accepted blockers/majors only, each with a regression test where applicable.
4. Human performs real-phone and manual checks from TESTING.md.

## M5 — Delivery (H with CC drafting)
- README (quick start, accounts, seed data, run without Docker, tests, reset, phone testing, troubleshooting).
- DECISIONS final: features actually added, known limitations/unfinished work.
- AI_USAGE final: update planned roles to actual usage from logs/reviews; do not claim a tool did work it did not do.
- Fresh clone → `docker compose up --build` → login with README accounts.
- CI green on final commit. Push. Then send link.

---

## Stretch (only after M4, in this order)
S1 results CSV export with UTF-8 BOM · S2 correct-answer review after quiz closes · S3 extend close time on a locked quiz · S4 Arabic UI toggle · S5 per-question teacher statistics.

## Out of scope (write these in DECISIONS.md → “Deliberately left out”)
Self-registration · password reset/emails · admin UI (accounts come from seed files) · spreadsheet upload UI · real-time dashboards/WebSockets · notifications · question banks/reuse · option shuffling/anti-cheat · multi-centre tenancy · audit log · background jobs/queues/Redis · E2E browser tests · cloud deployment.
