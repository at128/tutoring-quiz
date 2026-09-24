# Tutoring Quiz: online quizzes for Nour's tutoring centre

Students log in on their phones, take a timed multiple-choice quiz once, and see their score. Teachers create quizzes (with or without negative marking), schedule them for one or more classes, and see the results. The interface is in **Arabic or English**: it follows the device, and the «العربية / English» button switches it. Arabic names and Arabic quizzes work throughout.

**Live demo:** https://quiz.just-atta.site (same sample accounts as below). The demo is shared, so someone may already have used a student account. Use the reserved accounts listed below, or run it locally with one command.

## Run it (one command)
Requirements: Docker Desktop (or Docker Engine with Compose v2).
```bash
git clone https://github.com/at128/tutoring-quiz.git && cd tutoring-quiz
docker compose up --build
```
Open **http://localhost:8080**. On first start the database is created and migrated, then filled with sample data.
Is port 8080 busy? Run `APP_PORT=8081 docker compose up --build` and use :8081 instead (PowerShell: `$env:APP_PORT=8081; docker compose up --build`).

## Sample accounts
Each student can take each quiz **once**, so several untouched accounts are reserved for you.

| Role | Username | Password | What you'll see |
|---|---|---|---|
| Student 10A | `10a-01` … `10a-05` | `Student@2026` | Arabic grammar quiz (open, negative marking), Algebra (open), Physics in Arabic (upcoming) |
| Student 10B | `10b-01` … `10b-05` | `Student@2026` | Arabic grammar (open), Physics (upcoming), English Unit 4 (closed: missed) |
| Student 11A | `11a-01` … `11a-05` | `Student@2026` | Algebra (open), English Unit 4 (closed: missed) |
| Teacher | `teacher.reem` | `Teacher@2026` | Arabic grammar quiz with results already coming in |
| Teacher | `teacher.lina` | `Teacher@2026` | Closed English quiz with a full set of results |
| Teacher | `teacher.sami` | `Teacher@2026` | Algebra (open) and a draft Geometry quiz |
| Teacher | `teacher.khaled` | `Teacher@2026` | Upcoming Physics quiz (still editable) |

Usernames aren't case-sensitive. There is no admin role (see DECISIONS.md).

**Start over with fresh data:** `docker compose down -v && docker compose up --build`.

## Try the main journeys
1. **Student** (phone width): sign in as `10a-01` → open the Arabic grammar quiz → answer a few questions, refresh the page (answers and the timer survive) → submit → see the score and how it was calculated.
2. **Teacher:** sign in as `teacher.khaled` → **New quiz** → add an Arabic question and pick the correct answer → **Publish**. Sign in as a student in that class to take it, then open **Results** as the teacher.
3. **Rules to poke at:**
   - Start a quiz in two tabs: you get one attempt.
   - Let the timer run out: the quiz is finalized with the saved answers only.
   - Try editing a quiz that students have started: it's locked.

## Sample data
The sample data is loaded from plain files in `seed/`:
- `classrooms.csv` and `teachers.csv`;
- `students.csv`: 60 students in 10A, 10B and 11A;
- `quizzes.json`: 4 quizzes of 15 questions, plus 1 draft.

Quiz dates are relative to the first start, so the demo always has open, upcoming and closed quizzes. To load a centre's real lists, replace the CSV files (Excel's "CSV UTF-8" export works) and reset the data. Details: `docs/SEED_DATA.md`.

## Try it on a phone
Put the phone and the computer on the same Wi-Fi, then open `http://<your-computer's-LAN-IP>:8080`. The sign-in cookie works over plain HTTP on the LAN; behind HTTPS it's `Secure`.

## Run without Docker
Requirements: .NET SDK 9 and Node.js 24.
```bash
dotnet run --project src/TutoringQuiz.Api            # API on http://localhost:5080 (seeds on first run)
cd frontend && npm ci && npm run dev                   # app on http://localhost:5173 (proxies /api to :5080)
```
The development database is `src/TutoringQuiz.Api/tutoringquiz.db`. Delete it to reseed.

## Tests
```bash
dotnet test                                            # domain rules + HTTP integration tests on real SQLite files
cd frontend && npm ci && npm run lint && npm run typecheck && npm test && npm run build
```
- **Backend:** the integration tests run the real API against a fresh SQLite file per test and a fake clock. They cover:
  - the one-attempt rule under concurrent starts, and resume;
  - deadline boundaries, including rejecting answers after `DeadlineUtc`;
  - lazy expiry and scoring with negative marking;
  - that the correct answers never leak while a quiz is in progress;
  - ownership and roles, and quiz locking;
  - validation limits.
- **Frontend:** the unit tests cover the answer/autosave state, the timer phases, the server-clock offset, the quiz editor's validation (including impossible local times) and the results sorting.
- **CI:** GitHub Actions runs the backend, frontend and Docker-build jobs on every push and pull request.

## Project structure
```
src/
  TutoringQuiz.Domain          entities and rules: timing, scoring, one attempt, locking (no dependencies)
  TutoringQuiz.Application     use cases (one handler per action), validation, views
  TutoringQuiz.Infrastructure  EF Core + SQLite, migrations, password hashing, seeding
  TutoringQuiz.Api             controllers, cookie auth, ProblemDetails errors, rate limit, serves the SPA
frontend/                      React + TypeScript + Vite + Tailwind; features/{auth,student,teacher}
tests/                         Domain tests and API integration tests (xUnit)
seed/                          sample classes, teachers, students and quizzes
deploy/                        optional live-demo hosting (not needed to run the project)
docs/                          brief, architecture, domain rules, API contract, design, test plan
```
More in `docs/ARCHITECTURE.md`.

## Troubleshooting
- **Port 8080 is in use.** Use `APP_PORT=8081` (see above).
- **Stale data or a strange state.** Run `docker compose down -v`, then `docker compose up --build` again.
- **"Too many sign-in attempts."** The limit is 10 attempts per minute for one username from one network, and 100 per minute from one network. Wait a minute.
- **Times look shifted.** Times are stored in UTC and shown in your device's time zone.

## More
- `DECISIONS.md`: what the brief didn't say and what I decided
- `AI_USAGE.md`: how AI tools were used and checked
- `AGENTS.md`, `CLAUDE.md`, `docs/WORKFLOW.md`, `prompts/`: the agent configuration and prompts actually used
- `deploy/README.md`: how the live demo is hosted
