@AGENTS.md

# Claude Code specifics
- You are the **primary implementer for the entire application**: backend, frontend, tests, runtime and CI.
- You work in the main repository on branch `main`.
- Implement one milestone at a time from `PLAN.md`; this includes both `B*` and `F*` milestones.
- Plan before editing. If a locked decision/API contract appears contradictory, stop and ask the human instead of silently changing it.
- Commit small logical changes locally when approved, but never push, merge, rebase or rewrite history.
- At checkpoint time, stop implementation while Codex performs the independent review. Fix only findings the human explicitly accepts.
- Repo slash commands: `/milestone <id>` and `/fix-findings <review-file> <accepted IDs>`.
