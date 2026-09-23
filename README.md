# Tutoring Quiz — online quizzes for Nour's tutoring centre

Students log in on their phones, take timed multiple-choice quizzes once, and see their score. Teachers create quizzes (with or without negative marking), schedule them, and see results. Arabic names and Arabic quizzes work throughout.

> Status: in progress — this README is completed in milestone M5. Sections marked TODO are filled then.

## Run it (one command)
Requirements: Docker Desktop (or Docker Engine with Compose v2).
```bash
git clone <repo-url> && cd tutoring-quiz
docker compose up --build
```
Open **http://localhost:8080**. The database is created, migrated and filled with sample data on first start.
Port 8080 busy? `APP_PORT=8081 docker compose up --build` (then use :8081).

## Sample accounts
Each student can take each quiz **once**, so several untouched accounts are reserved for you.

| Role | Username | Password | What you'll see |
|---|---|---|---|
| Student 10A | `10a-01` … `10a-05` | `Student@2026` | Arabic grammar quiz (open, negative marking), Algebra (open), Physics in Arabic (upcoming) |
| Student 10B | `10b-01` … `10b-05` | `Student@2026` | Arabic grammar (open), Physics (upcoming), English Unit 4 (closed — missed) |
| Student 11A | `11a-01` … `11a-05` | `Student@2026` | Algebra (open), English Unit 4 (closed — missed) |
| Teacher | `teacher.reem` | `Teacher@2026` | Arabic grammar quiz with results already coming in |
| Teacher | `teacher.lina` | `Teacher@2026` | Closed English quiz with a full set of results |
| Teacher | `teacher.sami` | `Teacher@2026` | Algebra (open) and a draft Geometry quiz |
| Teacher | `teacher.khaled` | `Teacher@2026` | Upcoming Physics quiz (still editable) |

There is no admin role (see DECISIONS.md). Start over with fresh data: `docker compose down -v && docker compose up --build`.

## Sample data
Loaded from plain files in `seed/` — `classrooms.csv`, `teachers.csv`, `students.csv` (60 students in 10A/10B/11A), `quizzes.json` (4 quizzes of 15 questions + 1 draft). Quiz dates are relative to the first start, so the demo is always live. To load a centre's real lists, replace the CSV files (Excel's "CSV UTF-8" export works) and reset the data. Details: `docs/SEED_DATA.md`.

## Try it on a phone
Phone and computer on the same Wi-Fi → open `http://<your-computer's-LAN-IP>:8080`.

## Run without Docker — TODO (M5)
## Tests — TODO (M5)
`dotnet test` · `cd frontend && npm ci && npm run build && npm run lint`

## Project structure — TODO (M5)
See `docs/ARCHITECTURE.md`.

## More
- `DECISIONS.md` — what the brief didn't say and what I decided
- `AI_USAGE.md` — how AI tools were used and checked
- `AGENTS.md`, `CLAUDE.md`, `prompts/` — the agent configuration and prompts actually used
