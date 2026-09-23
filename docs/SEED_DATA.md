# Seed data

Sample data lives in plain files in `seed/` — the kind of thing a centre exports from a spreadsheet — so Nour's real lists can replace them later without code changes.

| File | Columns / shape |
|---|---|
| `seed/classrooms.csv` | `name,grade` |
| `seed/teachers.csv` | `username,full_name,subject` |
| `seed/students.csv` | `username,full_name,class` (60 students: 20 each in 10A, 10B, 11A; mostly Arabic-script names, some Latin-script) |
| `seed/quizzes.json` | quizzes with teacher, classes, relative open/close hours, duration, penalty, published flag, questions/options, optional `demoAttempts` |

## Seeder rules (`Infrastructure/Seeding/DemoDataSeeder`)
- Runs at startup only when `Seed:Enabled=true` **and** the Users table is empty. Reads from `Seed:Path` (Docker `/app/seed`; local dev: the repo's `seed/` copied to the API output directory).
- Parse CSV with a real CSV parser (quoted fields, commas inside quotes) and **accept a UTF-8 BOM** — Excel's "CSV UTF-8" export adds one.
- Fail fast with a clear message naming file and line when data is invalid (unknown class, duplicate username, question without exactly one correct option).
- Passwords come from configuration: `Seed:StudentPassword` (default `Student@2026`) and `Seed:TeacherPassword` (default `Teacher@2026`). They're demo credentials and are printed in the README.
- Times: `opensInHours` / `closesInHours` are relative to the seeding moment, so the demo is always "live" whenever a reviewer runs it.
- Build quizzes through Domain methods so seed data obeys the same invariants as teacher-created data.

## Demo attempts (so teacher results aren't empty)
For each quiz with `demoAttempts`:
- Take students of the listed classes ordered by username, skip the first `skipFirstPerClass` (**reserved for reviewers**: `*-01` … `*-05` never get demo attempts), then at most `maxPerClass`.
- Deterministic randomness: `new Random(20260924 + quizIndex)`; student ability `p = 0.45 + (stable hash of username % 50) / 100` (0.45–0.94). Use a stable hash (e.g. sum of UTF-16 code units), not `string.GetHashCode()`, which changes per process.
- Per question: 7 % unanswered; otherwise correct with probability `p`, else a random wrong option.
- Pick `startedAt` inside the quiz window so the attempt finished before "now"; compute the deadline with the domain formula; `expiredRatio` of attempts end as `Expired` (finalized at the deadline), the rest `Submitted` a few minutes before the deadline.
- Scores are computed with `QuizScoring` — never written by hand.

## What a reviewer sees
| Account | Sees |
|---|---|
| `10a-01` (…`10a-05`) | Arabic grammar quiz (open, −25 %), Algebra (open, no penalty), Physics in Arabic (upcoming) |
| `10b-01` (…`10b-05`) | Arabic grammar (open), Physics (upcoming), English Unit 4 (closed → Missed) |
| `11a-01` (…`11a-05`) | Algebra (open), English Unit 4 (closed → Missed) |
| `teacher.reem` | Arabic grammar quiz with 10 finalized attempts from 10B while still open |
| `teacher.lina` | English Unit 4 (closed) with ~26 finalized attempts, a few Expired, some Missed |
| `teacher.sami` | Algebra (open, no attempts yet) + a Geometry **draft** |
| `teacher.khaled` | Physics (scheduled, editable) |

Every student can take each quiz once, so the README lists several reserved accounts and the reset command `docker compose down -v`.
