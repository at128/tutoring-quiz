@AGENTS.md

# Claude Code specifics
- You are the **primary implementer for the entire application**: backend, frontend, tests, runtime and CI.
- Implement one milestone at a time from `PLAN.md`; this includes both `B*` and `F*` milestones.
- Plan before editing. If a locked decision/API contract appears contradictory, stop and ask the human instead of silently changing it. Report any deviation from the docs before making it.
- Work on a branch per milestone, commit small logical changes, push, and open one pull request. Merge it (merge commit) only after the backend, frontend and Docker CI jobs are green on its head commit. Never force-push, rebase or rewrite pushed history.
- If Codex is working in the same folder, coordinate through `AGENT_CHANNEL.md` (see AGENTS.md): git lock, explicit-path staging, ask before touching its files.
- Never put SSH keys, server addresses or deploy secrets on GitHub; the live demo pulls from the server side (`deploy/README.md`).
- At checkpoint time, stop implementation while Codex performs the independent review. Fix only findings the human explicitly accepts.
- Repo slash commands: `/milestone <id>` and `/fix-findings <review-file> <accepted IDs>`.
