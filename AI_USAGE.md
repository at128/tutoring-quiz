# AI usage

This file is intentionally kept factual. It distinguishes **work that has already happened** from the **planned workflow**. Before submission I will update it from the actual Git history, `docs/ai-log/` and `docs/reviews/`; I will not claim that a tool performed work it did not actually perform.

## Tools used so far
| Tool | What it actually did so far |
|---|---|
| **ChatGPT** | Read the assessment brief, explained the requirements, reviewed the engineering process and commit history of my earlier CodeArena project, proposed an initial scope/workflow, and reviewed the kickoff package produced by Claude. |
| **Claude (claude.ai chat)** | Critiqued the initial plan and produced the kickoff package: `AGENTS.md`, `CLAUDE.md`, `docs/`, `PLAN.md`, draft deliverable docs, prompts, and realistic seed data. I reviewed that package and changed several decisions before coding began. |
| **Claude Code** | *Not yet used for implementation at the time of this draft.* Planned as the primary implementation agent for backend + frontend. Update this row with actual work after each milestone. |
| **OpenAI Codex (VS Code)** | *Not yet used for project implementation/review at the time of this draft.* Planned as an independent reviewer at checkpoints and final adversarial review. Update this row only with reviews/work it actually performs. |

## Human decisions made before implementation
I reviewed the AI-generated plan instead of accepting it unchanged. In particular:
- kept the proposed **Clean Architecture** (Domain, Application, Infrastructure, Api) but kept it lean: no MediatR/CQRS pipeline, generic repositories, AutoMapper, separate Contracts project, worker or queue;
- kept cookie authentication, SQLite, real-SQLite integration tests, fake/injected time, lazy attempt finalization, relative seed dates, and the mobile/Arabic requirements;
- **removed the proposed 15-second answer grace after the deadline**: no answer saved after `DeadlineUtc` may affect score; a late submit finalizes from answers already saved;
- changed the execution model so **Claude Code is the primary implementer for the whole application** and **Codex is the independent reviewer**, instead of pre-assigning backend/frontend implementation to different agents;
- kept the reason for avoiding MediatR/AutoMapper/FluentAssertions engineering-focused: simpler architecture and less ceremony/dependency surface for this assessment.

## Planned implementation/review workflow — update with reality as work happens
- Claude Code implements one milestone at a time from `PLAN.md` on `main` and records actual commands/results in `docs/ai-log/claude-code.md`.
- Codex reviews at C1/C2/C3 and M4 in read-only mode (except the review report), recording concrete findings in `docs/reviews/` and a short factual note in `docs/ai-log/codex.md`.
- I approve/reject review findings, inspect high-risk code, run/manual-test the app, push, and finalize the submission.
- `docs/API.md` is a locked contract; changes require my approval.

## How output will be checked
- **Automated:** backend build/tests (real SQLite where persistence behavior matters, injected/fake time), frontend build/lint, CI on pushes.
- **Independent review:** Codex at checkpoints/final review, focused on correctness/security/races/time/score/mobile/Arabic/clean startup rather than style.
- **My own review:** scoring, deadline calculation, start/resume concurrency, answer ownership, correct-answer leakage, authorization, seed correctness, README reproducibility.
- **Manual:** full student journey on a real phone, including Arabic content, refresh/lock/resume, and teacher results; fresh-clone one-command startup.

## Activity log *(fill from actual work only)*
| Milestone | Tool | What it actually did | What I checked / changed |
|---|---|---|---|
| Planning | ChatGPT, Claude | requirements analysis, CodeArena review, kickoff package | reviewed package; changed deadline grace, tool roles, and stated dependency rationale |
| M0 | | | |
| B1 | | | |
| F1 | | | |
| C1 | | | |
| B2 | | | |
| F2 | | | |
| C2 | | | |
| B3 | | | |
| F3 | | | |
| C3 | | | |
| M4 | | | |
| M5 | | | |

## Where AI was wrong or I overruled it *(fill honestly as work progresses)*
- Kickoff draft proposed a 15-second post-deadline answer grace; I removed it because it effectively extends quiz time and the server cannot securely distinguish network delay from a genuinely late answer.
- Kickoff draft pre-assigned Claude Code to backend and Codex to frontend. I changed this before implementation: Claude Code is the primary implementer; Codex is the independent reviewer.
- …

## What I'd do differently next time
- …
