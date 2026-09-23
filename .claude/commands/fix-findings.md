---
description: Fix accepted findings from a Codex review report
argument-hint: <path to review file> <accepted IDs>
---
Arguments: $ARGUMENTS (review file path, then the finding IDs the human explicitly accepted).

Read the local review report. Act only on accepted IDs; do not act on rejected findings.
For each accepted finding: reproduce it (failing test first where possible), fix the cause minimally, and commit referencing the finding ID, e.g. `fix(api): check option belongs to question (C2-01)`.

Finish with the relevant full checks (backend and/or frontend), append the fix work to docs/ai-log/claude-code.md, and report a table: ID → change → test/check that covers it.
