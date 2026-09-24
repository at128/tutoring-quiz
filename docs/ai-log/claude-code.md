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

### Hand-back review + F2 student flow — 2026-09-23 night → 24 early
Asked to: take implementation back from Codex, report the current state, then finish the student journey exactly as the approved Claude Design prototype (`docs/design/Weekly Quizzes — UI UX.html`) shows it, with the locked rules unchanged. Set up the GitHub repo with one PR per milestone.
Did: read Codex's B2/B3 code and committed its pending, verified fix (start after lazy expiry). Pushed `main` at the planning commit and replayed the existing history as PRs #1 M0 … #5 B3 (same commit SHAs, merge commits, CI green on each). Unpacked every prototype screen and built from its markup: app bar, list cards, start states, take-quiz (header timer with 4 phases, progress ticks, answer-sheet options with roving radio keys, save status, connection banner, 5/1-minute notices, navigator bottom sheet, submit dialog, time-up dialog), results (submitted/expired/negative), sign-in (error, rate-limit wait), loading/empty/error/404 states. Pure core with Vitest tests: answer state reducer (server-confirmed vs chosen), timer phases/notices/backoff, server-clock helpers.
Behaviour kept from the locked rules: timer = server deadline − (device time + measured offset); resync on visibility/pageshow; at 0:00 options disable, autosave stops sending/retrying, submit is called once and the server scores only persisted answers; manual submit waits for pending saves only while time remains; no double submit; `beforeunload` only while answers are unsent.
Checked: `npm run typecheck` 0 errors · `npm run lint` clean · `npm test` 16/16 · `npm run build` ok. Real app (API + Vite, fresh seeded DB) driven with Playwright on the installed Edge at 360 px and 1280 px: sign-in + wrong password, list (available/upcoming/in progress/completed), Arabic and English questions, navigator, submit dialog, result, connection lost (offline → "Not saved yet — retrying" → back online saved), time up (browser clock jumped 20 min: options disabled, time-up dialog; the server still recorded Submitted because its own clock had not reached the deadline). Screens compared side by side with the prototype renders.
Unsure about / assumptions: list/start "Submitted <date>" uses the attempt deadline's date (the list API has no finalizedAt); percentages on list/start are display-only (score/max). Integration tests and Docker were not re-run for this frontend-only milestone.
Human changed or rejected: Atta asked for PRs per milestone (Claude merges after green CI) and for the frontend to follow the prototype exactly rather than be inspired by it.

### F3 teacher UI + coordination with Codex — 2026-09-24
Asked to: build the teacher journey (my quizzes, editor, locked view, results) exactly as the approved prototype shows it; later, coordinate with Codex, which was auditing the same working tree in parallel.
Did: teacher bar and 1280 px layout; list (table on md+, cards on phones, state order, lock footnote); editor as a pure form model (view ⇄ values ⇄ request, validation mirroring DOMAIN limits, problems keyed like the server's `errors`) with details, questions (add/move/delete/correct option, one open at a time below 1024 px), sticky aside, mobile footer, draft/publish/unpublish/delete, server-problem mapping and the locked/has-attempts banner; read-only locked view; results (tiles, class filter, sort with unscored rows last, table/cards). Set up a local, uncommitted `AGENT_CHANNEL.md` (append-only messages, file ownership, a git lock, explicit-path staging only) so Codex and I don't overwrite each other's uncommitted work.
From Codex's audit: included its HF-01 list refresh at the next opening/closing instant; fixed HF-02 (impossible dates and DST-gap times were silently shifted by `Date`) and its precision finding (saving an untouched quiz truncated stored seconds) by keeping the stored instants in the form until the teacher changes the minute shown.
Checked: `npm run typecheck` 0 errors · oxlint exit 0 · Vitest 41/41 on a clean export of the branch head (55/55 with Codex's uncommitted tests in the tree) · `npm run build` ok. Playwright on Edge (Asia/Amman) against the dev API: list, editor (problems, publish, mobile draft), locked view and results on desktop and 360 px, compared with prototype renders; an untouched save PUTs the exact stored times, an edited time converts correctly.
Unsure about / assumptions: the impossible-time message ("That date and time doesn't exist in your time zone. Choose another.") is new copy, since the prototype has no such state. Integration tests and Docker were not re-run for this frontend-only milestone.
Human changed or rejected: Atta asked the two agents to coordinate directly ("نسقوا مع بعض") and to talk through a shared file.

### Live demo, login limit, M5 drafts — 2026-09-24 morning
Asked to: set up CI/CD to https://quiz.just-atta.site on Atta's server without breaking anything on it; keep coordinating with Codex; make README/DECISIONS/AI_USAGE accurate.
Did:
- **Server survey first.** Listening ports (80/443/8080 Traefik, 8000 Coolify, 6001-2, 22). Traefik v3.6 settings (`coolify` network, `letsencrypt` resolver). Existing Host rules: none for `quiz.`, and the only catch-all has priority -1000.
- **First attempt, stopped by Atta.** A push deploy with a restricted forced-command key meant to be stored as a GitHub secret. Atta stopped it ("no SSH on GitHub"). Nothing had been uploaded; I removed the key, user and sudo rule from the server and deleted the local key.
- **Rebuilt as a server-side pull (PR #8).** A systemd timer runs `tq-deploy poll` every minute: `git ls-remote` → the CI verdict from the public API → build on the server → health check through Traefik → rollback on failure. No host port, only additions on the server.
- **Login limit (PR #9, approved by Atta).** Changed from 10/min per IP to 10/min per IP + username in the login action, plus a 100/min per-IP middleware cap, because a class on one Wi-Fi shares an IP.
- **Docs.** Drafted README, DECISIONS §3/§4/§5/§6, AI_USAGE, and the workflow docs, which now record what actually happened.
Checked:
- **Live demo:** first deploy healthy in 42 s. Externally: `/api/health` 200; HTTP→HTTPS 302; a Let's Encrypt certificate; deep links serve the SPA; the login cookie is `secure; httponly; samesite=strict`; the server's other sites unchanged; listening ports unchanged; Playwright smoke test on the live site (student at 360 px, teacher on desktop) with no errors.
- **Clean run:** `docker compose up --build` from a clean export of `main` seeded 3/4/60/5/36 and served health, SPA routes and ProblemDetails 404s.
- **Login-limit branch:** clean export `dotnet test -c Release` → 20 + 54 passed; CI green on PRs #8 and #9.
Unsure about / assumptions: the pull deploy uses GitHub's unauthenticated API, which allows 60 requests/hour per IP. It's asked only while a new head waits for CI, and a failed call counts as "pending".
Human changed or rejected: no SSH or server access on GitHub (pull deploy instead); login limit per IP + username approved; browser E2E tests kept out of scope.

### Arabic interface (PR #12) — 2026-09-24 late morning
Asked to: make the whole site work in Arabic, not only the questions, with no left-to-right glitches, and test every edge case, especially Arabic.
Did: a small i18n layer (`src/i18n`: `en.ts` is the source, `ar.ts: Messages` so TypeScript enforces key parity), device-language detection with a remembered «العربية / English» switch, right-to-left layout with mirrored directional icons, Arabic plurals (`Intl.PluralRules`), fixed Arabic day/month names with Western digits, and Unicode isolation for signed numbers and percentages. Fixed M4-02 (the editor checks against the time of the last save) and M4-03 (a failed class list offers Try again).
Checked: Vitest 132/132 (dictionary parity, no Latin in Arabic strings, a scan for hard-coded copy, Arabic dates/plurals/editor/results); typecheck; oxlint 0 warnings; build. Playwright tour of 15 screens at 360 px and 1280 px, locally and on the live demo: `lang=ar dir=rtl`, no horizontal scroll, no page errors.
Unsure about / assumptions: native date pickers follow the device's own digits.
Human changed or rejected: Atta chose device language + switch, Western digits, the month names يناير/فبراير, and unit tests + browser E2E in CI.

### M4 fixes and browser E2E in CI (PR #13) — 2026-09-24 midday
Asked to: take over Codex's open items after Codex reached its usage limit, and make sure everything works.
Did: committed Codex's Playwright harness, CI job and Arabic-content HTTP tests (credited to Codex in the commit). Fixed M4-01 (a same-origin guard for unsafe `/api` requests), M4-04 (the teacher list counts an attempt past its deadline as finalized) and the blank-text rule on the server (`VisibleText`, the editor's exact character classes). Added browser tests for M4-02/M4-03 and blank Arabic text. Found and fixed Arabic-Indic digits in number fields on Windows set to an Arabic region. Added daily and pre-deploy database backups with a restore command to the live demo.
Checked: `dotnet test` 47 + 95; Vitest 135; Playwright 7/7 against a fresh container; CI green on all four jobs; the backup installed and run on the server (integrity check ok, row counts matched).
Unsure about / assumptions: `restore` was not run against the live data (the tool denied overwriting it); it is tested only by reading the script.
Human changed or rejected: Atta accepted all four M4 findings and the blank-text rule, and asked for backups on a volume.

### Score floor, run scripts, fixes (PR #14) — 2026-09-24 early afternoon
Asked to: no score below zero; an easy way to run the project anywhere.
Did: the total is floored at 0 in `QuizScoring`, with a data migration for stored negative totals (tested by migrating down and up); `run.sh` / `run.cmd` (Docker checks, free port, health wait, phone address, `--reset`, `--stop`); fixed a phone header where a long name covered the language button, and titles in the other direction floating inside a wide box.
Checked: `dotnet test` 48 + 96; Vitest 135; `run.cmd` start/stop/reset/bad option on Windows and `run.sh` in Git Bash; ShellCheck clean; CI green.
Unsure about / assumptions: `run.sh` was not run on macOS or Linux (only Git Bash); it avoids bash 4 features.
Human changed or rejected: Atta reversed the earlier "negative totals are allowed" decision.
