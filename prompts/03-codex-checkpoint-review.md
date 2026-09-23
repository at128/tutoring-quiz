# Prompt → Codex — checkpoint independent review (read-only)

You are the **independent reviewer**, not an implementer.

Checkpoint: **<C1|C2|C3>**  
Base tag: **<cp0|cp1|cp2>**  
Review scope: `git diff <base-tag>..HEAD` plus full files whenever the diff lacks context.

Read: `AGENTS.md`, relevant parts of `PLAN.md`, `docs/DOMAIN.md`, `docs/API.md`, `docs/FRONTEND.md`, `docs/TESTING.md`, `docs/ARCHITECTURE.md`.

Do **not** modify implementation code. The only repository file you may create/update is:
`docs/reviews/<checkpoint>-codex-review.md`.

Review the whole changed stack, not just one side. Focus on concrete failures:
- scoring and negative marking;
- deadline calculation, **no post-deadline answer grace**, lazy expiration/finalization, idempotent submit/resume;
- concurrent starts and the one-attempt DB guarantee;
- authorization/IDOR: other student's attempt, other teacher's quiz, wrong class, option from another question/quiz;
- any path where correct-answer data can leak during an attempt;
- malformed/huge/null input producing 500 instead of controlled 4xx;
- API shapes/error codes vs `docs/API.md`;
- frontend timer uses server offset, visibility resync, no double-submit, autosave/flush behavior;
- mobile 360 px, Arabic `dir="auto"`, logical CSS, 16 px inputs, loading/error states, accessibility basics;
- tests that do not actually prove the documented rule (EF InMemory, sleeps, missing concurrency proof);
- runtime/CI changes that can break clean-machine startup.

Use the review format in `docs/WORKFLOW.md`. Give each finding a concrete failing scenario and severity; list blockers first. Also list important areas you checked and found correct.

Do not fix findings. Do not commit implementation changes. Append a short factual review note to `docs/ai-log/codex.md` only if I ask you to update the repo; otherwise just produce the report/content for me.
