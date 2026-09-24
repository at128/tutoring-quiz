# Workflow — one primary implementer, one independent reviewer, one human

## What actually happened (changes Atta made to this plan during the work)
The plan below is kept as it was written. This is how the work actually ran; `AI_USAGE.md` and `docs/ai-log/` have the details.

1. **The implementer changed hands twice.**
   - Claude Code did M0 and B1, and started F1.
   - When it hit its usage limit (Wed evening), Atta handed implementation to **Codex**. Codex finished F1 and implemented **B2 and B3** (student attempts, teacher authoring and results, HTTP integration tests).
   - Claude Code took over again for **F2 and F3** (the student and teacher UI, built from the approved Claude Design prototype).
2. **Pull requests instead of "agents never push".** From Thu 00:00, each milestone lands as one GitHub pull request. Claude Code pushes the branch and merges it with a merge commit **only after all three CI jobs (backend, frontend, Docker build) are green**. The earlier local history was replayed as PRs #1–#5 with the same commits. Nobody force-pushes, rebases or rewrites history.
3. **Reviews.**
   - The formal C1–C3 checkpoint reports weren't produced as separate files.
   - Codex's **backend/frontend handler audit** (`docs/reviews/backend-frontend-handler-audit-codex-review.md`) covered all handlers and the frontend logic up to F3. Its findings were triaged and fixed with tests (HF-01, HF-02 and follow-ups).
   - M4 (the adversarial whole-repo review) runs as planned.
4. **Two agents in one working tree (Thu morning).**
   - Codex audited while Claude Code built F3 in the same folder. They coordinated through `AGENT_CHANNEL.md`, a local file that is never committed and is excluded in `.git/info/exclude`.
   - That file holds append-only messages, a file-ownership table and a git lock. It also requires staging by explicit path only, and bans `add -A`, `stash`, `reset` and `clean`, so neither agent could commit or destroy the other's uncommitted work.
   - Atta settled the scope questions: browser E2E tests stay out, and the login limit moves to per IP + username.
5. **Live demo.** Atta asked for optional hosting at https://quiz.just-atta.site. The server **pulls** green commits of `main` itself (`deploy/README.md`), so no SSH key or server address is ever stored on GitHub (Atta's rule).

## Why this setup
1. **Single implementation context.** Claude Code owns both backend and frontend, so there is no branch/worktree coordination cost and no contract drift between two simultaneous implementers.
2. **Independent review.** Codex enters with fresh context at checkpoints and M4, read-only, to find defects the implementing model may miss.
3. **Human judgment remains explicit.** Atta approves plans, triages every review finding, pushes, and finalizes the deliverables.

Agents never push or merge. *(Superseded on Thu 00:00: see "What actually happened", point 2.)*

## Working layout
| Repository | Branch | Tool | Role |
|---|---|---|---|
| `tutoring-quiz/` | `main` | Claude Code | primary implementation: backend + frontend + tests + Docker + CI |
| same repository | `main` | Codex | checkpoint/final review only; may write the assigned review report |

No worktree is required by the default plan.

## Contract first
`docs/API.md` is locked before feature work. Claude Code implements both sides against it. If implementation reveals a contract change is truly required, Claude stops and asks the human. The human approves the change before code/docs are updated.

## Milestone loop
1. Claude Code implements one milestone from `PLAN.md`, runs checks, commits small logical changes, and reports.
2. The human runs/clicks the app and reads the risky files listed in the report.
3. After the paired backend/frontend milestones for a checkpoint are done, Codex reviews the diff since the previous checkpoint tag in **read-only review mode**.
4. Codex writes `docs/reviews/C<n>-codex-review.md`.
5. Human triages each finding: **accept** or **reject with a reason**.
6. Claude Code fixes accepted findings, adding regression tests where appropriate.
7. Human runs full checks, pushes, and tags `cp<n>`.

## Checkpoint procedure (C1, C2, C3)
Base tags:
- C1 → `cp0..HEAD`
- C2 → `cp1..HEAD`
- C3 → `cp2..HEAD`

Procedure:
```text
1) Claude reports both B<n> and F<n> implementation milestones done.
2) Human runs prompts/03-codex-checkpoint-review.md in Codex with checkpoint + base tag.
3) Codex writes one read-only full-stack review report.
4) Human accepts/rejects findings.
5) Claude runs prompts/04-claude-code-fix-findings.md for accepted IDs.
6) Full checks + manual click-through.
7) Human tags cp<n> and pushes.
```

Typical full checks:
```bash
dotnet build
dotnet test
cd frontend && npm ci && npm run build && npm run lint && cd ..
docker compose build
```

## Review report format (`docs/reviews/C<n>-codex-review.md`)
```markdown
# C2 — Codex independent review (cp1..HEAD)
Scope checked: <files/areas>
Checked and fine: <short list>

| ID | Severity | Where | Problem | How it breaks | Suggested fix |
|----|----------|-------|---------|---------------|---------------|
| C2-01 | blocker | src/.../SaveAnswerHandler.cs:48 | option not checked against question | student saves an option from Q5 into Q2 and it can affect score | verify option.QuestionId == questionId |
```

Severity:
- **blocker** — wrong results, security/privacy issue, data loss, crash, deadline bypass, clean-start failure
- **major** — broken required flow, serious mobile/Arabic UX failure, missing required behavior
- **minor** — quality/clarity issue that does not block the required flow

Reviewers prefer real defects over style, cite file/line, and describe a concrete failing scenario. No implementation edits in review mode.

## Final adversarial review (M4)
Codex reviews the whole repository as a byThursday evaluator trying to break it. Areas include:
- attempt duplication/concurrency
- deadline manipulation and late answer saves
- score manipulation / correct-answer leakage
- IDOR/authorization
- malformed or huge input causing 500s
- mobile/Arabic flows
- refresh/visibility/second-tab behavior
- README accuracy and one-command startup
- Docker/seed/migration failures
- claims in DECISIONS/AI_USAGE that do not match code/history

Codex writes `docs/reviews/M4-codex-adversarial.md`; human triages; Claude fixes accepted blockers/majors.

## Logging for AI_USAGE.md
- Claude Code appends concrete implementation notes to `docs/ai-log/claude-code.md`.
- Codex appends only reviews it actually performed to `docs/ai-log/codex.md`.
- `AI_USAGE.md` is a draft until finalization. Do not pre-fill future work as if it already happened.
- Human curates the final file from actual logs, Git history and review reports.
