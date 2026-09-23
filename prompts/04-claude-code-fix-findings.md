# Prompt → Claude Code — fix accepted Codex findings

Review report: `docs/reviews/<file>.md`  
Accepted finding IDs: **<IDs>**  
Rejected IDs: **<IDs>** — do not act on them.

For each accepted finding:
1. Reproduce it (prefer a failing regression test first when applicable).
2. Fix the cause minimally without reopening unrelated architecture/scope decisions.
3. Run the relevant checks.
4. Commit one finding or a tightly related group, referencing the finding ID, e.g. `fix(api): reject option from another question (C2-01)`.

At the end run the full checks for every area touched, append to `docs/ai-log/claude-code.md`, and report: ID → root cause → fix → regression test/check.
Never push/merge.
