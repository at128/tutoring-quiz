# Prompt → Codex — M4 final adversarial review (read-only)

Act as a byThursday evaluator whose job is to run this repository and try to break it. You are an independent reviewer, not an implementer. Do not modify implementation code.

Read the whole repository and the assessment brief. Try to find concrete ways to:
- take a quiz twice, create concurrent duplicate attempts, get extra time, save/replace an answer after `DeadlineUtc`, or gain points through a late request;
- manipulate score/negative marking or get client-controlled score/time/identity accepted;
- read correct answers during an attempt, another student's attempt/result, or another teacher's quiz;
- save an option that does not belong to the requested question/quiz;
- bypass class assignment, role checks, locking/publish rules;
- trigger 500s with malformed GUIDs, nulls, empty/oversized arrays, huge/long Arabic strings, invalid dates or concurrency races;
- break the student flow on a 360 px phone, slow/dropped connection, refresh, visibility change/lock, second tab, auto-submit, Arabic text or negative scores;
- break `docker compose up --build` on a fresh clone through missing files, volume permissions, migration/seed assumptions or bad ports;
- find README/DECISIONS/AI_USAGE claims that do not match code/history.

Where possible, include exact HTTP/browser reproduction steps.

Write `docs/reviews/M4-codex-adversarial.md` using the review format in `docs/WORKFLOW.md`. List blockers first, then majors/minors, plus areas checked and found correct. Do not fix anything.
