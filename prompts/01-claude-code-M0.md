# Prompt → Claude Code — M0 scaffold

You are the **primary implementation agent** for this repository. Read `CLAUDE.md` / `AGENTS.md`, then `PLAN.md` → M0 and the architecture/runtime docs it references.

Do not start implementation immediately.
1. Inspect the local toolchain (`dotnet --list-sdks`, Node/npm, Docker, Git).
2. In plan mode, list the exact files/projects you will create, dependency references, selected .NET target based on what is installed, and validation commands. Note any contradiction before coding. Wait for my approval.
3. Implement **M0 only**.
4. Scaffold the four Clean Architecture projects and two test projects exactly as documented; do not add layers/libraries outside the docs.
5. Scaffold React + TypeScript + Vite + Tailwind in `frontend/`; keep the UI minimal and make it call `/api/health`.
6. Add Docker/Compose and CI targeting the actual `main` branch.
7. Add the health integration test.
8. Run every M0 acceptance command and report exact results. Do not claim Docker/CI works unless observed.
9. Commit small logical commits when approved. Never push/merge.
10. Append a factual entry to `docs/ai-log/claude-code.md` and report in the AGENTS.md format.
