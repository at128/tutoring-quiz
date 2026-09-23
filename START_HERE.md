# START HERE — runbook for Atta

This package is the whole project context. **Claude Code is the primary implementer** and works in the repo on `main`. **Codex is the independent reviewer** at checkpoints and during the final adversarial review. The human (Atta) owns scope, architecture, approval of plans/findings, pushes, and the final submission.

Claude Code reads `CLAUDE.md`, which imports `AGENTS.md`. Codex should read `AGENTS.md` plus the review prompt it is given. Everything else (`docs/`, `PLAN.md`, `DECISIONS.md`, `seed/`) is read as needed.

## 0. Before anything
- [ ] Read `DECISIONS.md` section 2 once. These are *your* decisions now — change anything you disagree with before coding starts.
- [ ] Skim `seed/quizzes.json` and check the content you're responsible for (especially the Arabic grammar quiz).
- [ ] Important locked timing rule: **there is no answer grace period after the deadline.** Answers are accepted only at/before `DeadlineUtc`; a late submit finalizes using answers already saved before the deadline.

## 1. Create the repo
```bash
cd tutoring-quiz
git init -b main
git add -A
git commit -m "docs: add brief, decisions, API contract, plan and agent instructions"
# create an EMPTY public repo on GitHub named tutoring-quiz, then:
git remote add origin https://github.com/<you>/tutoring-quiz.git
git push -u origin main
```
Committing the plan first is intentional: the history shows planning came before code.

## 2. M0 with Claude Code
- Open the folder in VS Code and start Claude Code at the repo root.
- Paste `prompts/01-claude-code-M0.md`.
- Approve the plan before implementation.
- Let it build and run the required checks, including `docker compose up --build` when it asks.
- Check yourself: http://localhost:8080 loads and `dotnet test` passes.

Then:
```bash
git push
git tag cp0
git push --tags
```
Wait for GitHub Actions to go green. If it does not, fix it before feature work.

## 3. Implementation loop — Claude Code is the primary coder
Use `prompts/02-claude-code-milestone.md` (or `/milestone <id>`) for each implementation milestone, in this order:

```text
B1 → F1 → C1
B2 → F2 → C2
B3 → F3 → C3
```

Claude Code implements both backend and frontend on `main`, one milestone at a time. No worktree is required.

## 4. Checkpoints C1 / C2 / C3 — Codex reviews, Claude fixes
After both implementation milestones for a checkpoint are complete:

1. Open Codex in VS Code on the same repository.
2. Give it `prompts/03-codex-checkpoint-review.md` and specify the checkpoint and base tag (`cp0`, `cp1`, or `cp2`).
3. Codex is **read-only except for its report**. It reviews the whole diff since the previous checkpoint, including backend and frontend, and writes `docs/reviews/C<n>-codex-review.md`.
4. You read the findings and explicitly accept/reject each one.
5. Ask Claude Code to fix accepted findings using `prompts/04-claude-code-fix-findings.md` or `/fix-findings ...`.
6. Run the full checks, manually click through the affected flow, then tag the checkpoint.

Example after C1:
```bash
dotnet test
cd frontend && npm ci && npm run build && npm run lint && cd ..
docker compose build
git tag cp1
git push origin main --tags
```

Write a short factual entry in `AI_USAGE.md` after each checkpoint while you still remember what actually happened.

## 5. M4 — final adversarial review
- Give Codex `prompts/05-codex-final-adversarial-review.md`.
- Codex reviews the **whole repository** as a byThursday reviewer trying to break it; it only writes the review report.
- You triage the findings.
- Claude Code fixes accepted blockers/majors with regression tests where appropriate.
- **Real phone test:** laptop and phone on the same Wi-Fi → `http://<laptop-LAN-IP>:8080`. Take the Arabic quiz, lock the phone for a minute, unlock, submit, then log in as a teacher and check results.

## 6. M5 — delivery
- Claude Code: `prompts/06-claude-code-docs-finalize.md`.
- You personally edit/finalize `README.md`, `DECISIONS.md`, and especially `AI_USAGE.md` so they describe what **actually happened**, not the original plan.
- Clean-machine test:
```bash
cd /tmp
git clone https://github.com/<you>/tutoring-quiz.git tq-check
cd tq-check
docker compose up --build
```
- Log in with the README accounts.
- Confirm CI is green on the exact final commit.
- Push the final commit **before** sending the repository link. Anything pushed after submission may not be reviewed.

## If you fall behind
Cut in this order: stretch items → teacher results polish → teacher editor niceties (reorder) → frontend unit tests. Never cut: one-command startup, student flow on a phone, server-side timing/scoring/authorization rules and their tests, honest `DECISIONS.md` / `AI_USAGE.md`.

## Map of this package
| File | Purpose |
|---|---|
| `AGENTS.md` | shared implementation/review rules |
| `CLAUDE.md` | Claude-Code-specific primary-implementer instructions |
| `.claude/` | Claude Code permissions and slash commands |
| `PLAN.md` | milestones, acceptance criteria, checkpoints, out of scope |
| `DECISIONS.md`, `AI_USAGE.md`, `README.md` | assessment deliverables / drafts |
| `docs/BRIEF.md` | source requirements |
| `docs/ARCHITECTURE.md` | Clean Architecture layout, persistence, auth, runtime |
| `docs/DOMAIN.md` | business rules and formulas |
| `docs/API.md` | locked API contract |
| `docs/FRONTEND.md` | UX spec, mobile, Arabic, visual direction |
| `docs/TESTING.md` | required tests |
| `docs/SEED_DATA.md`, `seed/` | sample data and loading rules |
| `docs/WORKFLOW.md` | Claude-primary / Codex-review workflow |
| `prompts/` | prompts in execution order |
