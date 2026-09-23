# Brief — what we were asked to build

This is the requirements source of truth. It restates the byThursday practical-assessment PDF and the fictional client brief. Where the brief is silent, see `DECISIONS.md`.

## The client
Nour runs a small tutoring centre in **Amman** with about **300 students** and **12 teachers**. Weekly quizzes are on paper and it is painful. Nour wants a simple website. Nour is **not available for questions** — unclear points must be decided and documented.

## Required behaviour
**Students**
1. Log in.
2. See their available quizzes.
3. Start a quiz and take a **timed multiple-choice** quiz.
4. Submit and **see their score at the end**.
- Each quiz has a **time limit** (usually ~20 minutes), an **opening date/time** and a **closing date/time**.
- **A student must never be able to take the same quiz twice.**

**Teachers**
- Create quizzes, add questions and answer options, set availability and time limits.
- See how students performed.

**Negative marking**
- Some teachers use negative marking, some don't; it varies by teacher and by quiz. Both must be supported.

**Language**
- Many students have Arabic names and some quizzes are in Arabic. Arabic must work properly.

**Phones**
- Must work very well on phones — most students only have a phone to take the quiz. This is a core requirement, not polish.

## Sample data (we create it; it must be realistic and loadable)
- Classes **10A, 10B, 11A**, ~**20 students** each.
- **4 teachers** using the system initially.
- A typical quiz: **15 questions**, **4 options** each, **per-question points**.
- The real client will later send spreadsheets → data should come from files that look like what a centre would export.

## Technology & running
- Any language/framework/database.
- Reviewers run it from the README with **one command on a clean machine**. Docker Compose is the easiest way; a non-Docker SQLite path is acceptable if the README is exact.

## Deliverables (they check every item)
1. **Public GitHub repo** with complete source (not a build folder, zip, or only a deployed link).
2. **README.md** — how to run with one command, how sample data is loaded, login details for a student, a teacher, and any other role.
3. **DECISIONS.md** — assumptions; decisions made because the brief was unclear; features added that Nour didn't ask for and why; what was deliberately left out; what we'd build next with another week.
4. **AI_USAGE.md** — which AI tools, how they were directed, how output was checked. They read it closely; be honest. A committed `CLAUDE.md` or similar agent config is welcome.
5. **Automated tests** for the parts we believe matter most.
6. **Meaningful Git history** — commit as you go; one giant commit tells them nothing.

## How it will be evaluated
They read the whole repo, run it, and **try to break it**. They look at: handling of missing requirements, behaviour when users behave badly, mobile usability, code quality and structure, tests, AI tool usage, clarity of engineering decisions. The result is a decision, not a score.

## Time & submission
- 24 hours from receiving the email (received Wed 23 Sep 2026 ~16:59 local → due Thu 24 Sep 2026 ~16:59).
- Most people spend 6–10 focused hours. AI coding tools (Claude Code or similar) are expected for most of the implementation, and using them well is part of the skill being hired for.
- Submit by replying with the public repo link. **The repo is reviewed as it is at the moment the link is sent**; later pushes are ignored.
- If time runs out, submit anyway and document unfinished work in `DECISIONS.md`. An honest partial project with a clear plan beats a polished one that hides gaps.
