# Prompt → Claude Code — implementation milestone

Implement milestone **<B1|F1|B2|F2|B3|F3>** from PLAN.md — only that milestone.

You are the primary implementer for both backend and frontend. Stay on `main`.

1. Read the milestone section in PLAN.md plus only the relevant specs:
   - B*: `docs/DOMAIN.md`, `docs/API.md`, `docs/TESTING.md` (+ `docs/SEED_DATA.md` for B1).
   - F*: `docs/FRONTEND.md`, `docs/API.md`, and the backend endpoints already implemented for that flow.
2. In plan mode, list files to create/change, tests/checks you will run, and any ambiguity/contradiction. Wait for my OK.
3. Implement the milestone only. Do not silently change `docs/API.md` or locked decisions.
4. Backend rules: use injected `TimeProvider`; no client-authoritative identity/time/score; no post-deadline answer grace; never expose correct answers during an in-progress attempt.
5. Frontend: mobile-first at 360 px, Arabic user content `dir="auto"`, server-authoritative timer/eligibility/score, and real API integration.
6. Commit small logical Conventional Commits as parts go green. Never push/merge.
7. Run the milestone acceptance commands and report exact results.
8. Append to `docs/ai-log/claude-code.md` and list the 3–5 riskiest files for my review.
