# AI usage

This file is kept factual. It is written from the Git history, the pull requests, `docs/ai-log/` and `docs/reviews/`. It does not claim a tool did work it didn't do. Where something is still open, it says so.

## Tools and what each actually did
| Tool | What it actually did |
|---|---|
| **ChatGPT** | Read the assessment brief and explained the requirements. Reviewed the engineering process and commit history of my earlier CodeArena project, proposed an initial scope and workflow, and reviewed the kickoff package Claude produced. |
| **Claude (claude.ai chat)** | Critiqued the initial plan and produced the kickoff package: `AGENTS.md`, `CLAUDE.md`, `docs/`, `PLAN.md`, draft deliverable docs, prompts and realistic seed data. I reviewed it and changed several decisions before coding began (below). |
| **Claude Design** | Produced the UI/UX prototype (`docs/design/Weekly Quizzes — UI UX.html`) and `docs/DESIGN_HANDOFF_FINAL.md`. I approved them, and the frontend was built to match them screen by screen. |
| **Claude Code** | **M0** (scaffold, Docker, CI) and **B1** (domain rules, persistence, cookie auth, seeding), and started F1. After its usage limit reset, it did the following. *Reviewed and resumed:* read Codex's B2/B3, committed Codex's pending verified fix, created the GitHub repo and replayed the history as PRs #1–#5. *Built the UI:* **F2** (student UI, PR #6) and **F3** (teacher UI, PR #7), both from the prototype and compared with it in a headless browser at 360 px and on desktop. *Added:* the **live demo** (PR #8) and the **login limit fix** (PR #9). *Drafted docs:* README, DECISIONS, this file and the workflow docs. It merged each PR only after CI was green. |
| **OpenAI Codex (VS Code)** | Took over implementation while Claude Code was at its limit. It finished **F1** (sign-out failure handling, the session-check error state) and implemented **B2** (student attempts) and **B3** (teacher authoring and results), with HTTP integration tests on real SQLite files. It later ran a **backend/frontend handler audit** (`docs/reviews/backend-frontend-handler-audit-codex-review.md`) with new edge-case tests and fixes, in parallel with F3. **M4** (the adversarial whole-repo review): *(fill when done)*. |

## Human decisions
**Before implementation**, I reviewed the AI-generated plan instead of accepting it unchanged:
- I kept the proposed **Clean Architecture** (Domain, Application, Infrastructure, Api) but lean: no MediatR/CQRS pipeline, generic repositories, AutoMapper, separate Contracts project, worker or queue.
- I kept cookie authentication, SQLite, real-SQLite integration tests, injected time, lazy attempt finalization, relative seed dates, and the mobile and Arabic requirements.
- I **removed the proposed 15-second answer grace after the deadline**. No answer saved after `DeadlineUtc` may affect the score; a late submit finalizes from answers already saved.
- I made **Claude Code the primary implementer for the whole application** and **Codex the independent reviewer**, instead of splitting backend and frontend between them.

**During the work:**
- I stayed on **.NET 9** (no .NET 10 SDK on the machine) and kept the Vite template's **oxlint** instead of ESLint.
- I postponed Docker runs and the integration tests to the end of the early milestones, so fast checks ran in between.
- When Claude Code hit its usage limit, I **moved implementation to Codex** (F1 fixes, B2, B3), then **back to Claude Code** for F2/F3.
- I required **one pull request per milestone**, merged only after all CI jobs are green.
- I required the frontend to follow the **approved design exactly**, not just be inspired by it. The behaviour rules stay the source of truth: at the deadline, answers are disabled at once, and pending saves are neither sent, retried nor flushed afterwards.
- I asked for a **live demo** and forbade putting any SSH key or server access on GitHub. The deploy is therefore **pull-based** from the server.
- When Codex and Claude Code worked in the same folder at the same time, I told them to **coordinate directly**. They did it through a local channel file (see `docs/WORKFLOW.md`).
- I approved changing the login limit from per IP to **per IP + username**, and kept **browser E2E tests out of scope**.

## How the work was actually organised
See `docs/WORKFLOW.md` → "What actually happened". In short:
- One implementer at a time, except on Thursday morning, when Codex audited while Claude Code built F3.
- Each milestone was a PR, merged only after green CI.
- Review findings were triaged and fixed with regression tests.

## How output was checked
- **Automated:**
  - Backend: build with warnings as errors, domain unit tests, and HTTP integration tests. The integration tests run against a fresh SQLite file per test, with a fake clock, and cover concurrency races, deadline boundaries, answer-key secrecy, ownership and validation limits.
  - Frontend: lint, typecheck, unit tests, build.
  - GitHub Actions runs all of these plus a Docker build on every PR and push.
- **Clean machine:** `docker compose up --build` from a clean export of `main` created, migrated and seeded the database and served the app (checked by Claude Code on 24 Sep).
- **Visual and journey checks:**
  - Claude Code drove the real app with Playwright (Edge, Asia/Amman time zone) at 360 px and 1280 px, and compared each screen with the prototype.
  - Journeys covered: sign-in, quiz list, Arabic and English questions, autosave while offline, time-up, submit and result; the teacher list, editor, locked quiz and results.
  - These scripts live outside the repo and aren't in CI.
- **Independent review:** Codex's handler audit, and M4 *(fill when done)*.
- **My own checks:** *(Atta: real-phone journey, Arabic quiz, refresh/lock/resume, teacher results; fill in the result.)*

## Activity log
| Milestone | Tool | What it actually did | What I checked / changed |
|---|---|---|---|
| Planning | ChatGPT, Claude, Claude Design | requirements analysis, CodeArena review, kickoff package, UI/UX prototype | reviewed the package; removed the deadline grace, changed the tool roles, approved the design |
| M0 | Claude Code | solution scaffold, health endpoint, ProblemDetails, SPA hosting, Vite app, Dockerfile, compose, CI | .NET 9 and oxlint |
| B1 | Claude Code | domain model with scoring/timing rules and tests, EF Core + SQLite, cookie auth, rate limit, seeding | postponed Docker/integration tests during milestones |
| F1 | Claude Code → Codex | app shell and student list started by Claude Code; Codex finished sign-out failure handling and the session-check error state | moved implementation to Codex at Claude's limit |
| C1 | — | no separate checkpoint report was produced | — |
| B2 | Codex | start/resume, attempt view, save/clear answer, submit, result; integration tests (concurrent start, answer-key secrecy, deadline boundary, idempotent submit) | — |
| F2 | Claude Code | student UI from the prototype: list, start, take quiz (timer phases, autosave, navigator, submit and time-up dialogs), result; PR #6 | design must be followed exactly; deadline behaviour rules |
| C2 | — | no separate checkpoint report was produced | — |
| B3 | Codex | teacher classes, quiz CRUD, publish/unpublish/delete, results; serialized write transactions for races; lazy result finalization | backend-only milestone at my request |
| F3 | Claude Code | teacher list, editor (validation mirrors the server's), locked view, results; PR #7 | asked the agents to coordinate directly |
| Audit (in place of C3) | Codex, fixes by both | handler audit: list refresh at the next opening/closing (Codex's fix, in PR #7); impossible or DST-gap editor times and truncated seconds (fixed by Claude Code, PR #7); stale cookie after a user is deleted and an ambiguous-save state in autosave (Codex's fixes) *(link the PR when merged)* | triaged the findings |
| M4 | Codex | *(fill when done)* | *(fill)* |
| M5 | Claude Code | live demo (PR #8), per-IP+username login limit (PR #9), README/DECISIONS/AI_USAGE/workflow drafts, clean-machine Docker run | approved the login-limit change, kept E2E out of scope, forbade SSH on GitHub; *(final review of the docs)* |

## Where AI was wrong or I overruled it
- **The kickoff draft proposed a 15-second post-deadline answer grace.** I removed it: it effectively extends quiz time, and the server can't tell network delay from a genuinely late answer.
- **The kickoff draft pre-assigned Claude Code to the backend and Codex to the frontend.** I changed this before implementation.
- **The kickoff architecture limited sign-ins to 10/min per IP.** A class signing in together from the centre's Wi-Fi shares one IP, so half of them would have been blocked. Claude Code caught this while drafting the docs, and I approved the fix (per IP + username).
- **Claude Code started a push-based deploy with a dedicated deploy key stored as a GitHub secret.** I stopped it before anything was uploaded. The key, user and sudo rule it had added to the server were removed, and the deploy was rebuilt so the server pulls.
- **Claude Code agreed to Codex's proposal to add browser E2E tests without noticing `PLAN.md` lists them as out of scope.** It was caught before any work started, and I kept them out.
- **Codex's audit found real defects in earlier AI-written code:**
  - the editor silently moved impossible local times to other days;
  - saving a quiz truncated its stored seconds;
  - a deleted student's cookie could still read the quiz list;
  - autosave could treat an answer as saved after a failed request that may have reached the server.
  All were fixed with tests.

## What I'd do differently next time
- *(Atta to finalize.)* Drafted from what caused friction:
  - Set up PRs and CI from the first commit, instead of replaying history later.
  - Give each agent its own git worktree before running two at once.
  - Settle the hosting and secrets rules before any CI/CD work.
