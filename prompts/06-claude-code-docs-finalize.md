# Prompt → Claude Code — M5 draft final docs

Draft, don't finalize — I will edit. Only touch `README.md`, `DECISIONS.md`, and `AI_USAGE.md`.

- `README.md`: complete TODO sections (one-command Docker quick start, demo accounts, seed data, exact non-Docker commands if supported, tests, project structure, reset data, phone testing, troubleshooting). Verify every command you write by running it or explicitly say you could not verify it.
- `DECISIONS.md`: fill features actually added, known limitations and unfinished work from the code + M4 review. Keep the rationale for no MediatR/AutoMapper/etc. engineering-based: less ceremony and dependency surface for this assessment.
- `AI_USAGE.md`: update from actual `docs/ai-log/*.md`, `docs/reviews/*.md`, and Git history. Preserve the distinction between planning and actual implementation. Do not claim Codex implemented frontend/backend unless it really did. Record the removed 15-second grace as a human-overruled AI decision.

Report what you changed and anything uncertain. Do not push.
