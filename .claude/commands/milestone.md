---
description: Implement one milestone from PLAN.md (backend or frontend; plan first, then build/test)
argument-hint: <milestone id, e.g. B1 or F1>
---
Implement milestone $ARGUMENTS from PLAN.md — only that milestone.

1. Read the $ARGUMENTS section of PLAN.md and the docs it depends on. For B* read DOMAIN/API/TESTING (and SEED_DATA for B1). For F* read FRONTEND/API and the relevant backend milestone already implemented.
2. Present a plan: files to create/change, required tests/checks, and anything ambiguous. Wait for approval.
3. Implement only the milestone. The API must match docs/API.md exactly; if the contract must change, stop and ask.
4. For backend business rules, write the required tests alongside the code. For frontend, run against the real local API whenever the milestone expects it.
5. Commit small logical Conventional Commits as parts become green. Never push or merge.
6. Run the checks required by the milestone; append a factual entry to docs/ai-log/claude-code.md; report using AGENTS.md and list the 3–5 files the human should inspect most carefully.
