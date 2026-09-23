# Decisions

Nour wasn't available for questions, so every gap in the brief was decided here. Each entry says what I chose, why, and what I'd reconsider. Sections marked *(fill at the end)* are completed before submission.

## 1. Architecture

**Clean Architecture, deliberately lean.** Four backend projects (Domain, Application, Infrastructure, Api) with dependency direction enforced by project references.
- *Why:* I expect this product to grow — spreadsheet import, an admin role for Nour, more centres, possibly PostgreSQL. With the business rules (scoring, timing, one-attempt) isolated in a dependency-free Domain and use cases in Application, those changes stay local.
- *Trade-off I accepted:* for 300 students a single project with vertical slices would be faster to write. I kept the boundaries but refused the usual ceremony: no MediatR or pipeline behaviours, no generic repositories (Application uses an `IAppDbContext` interface), no AutoMapper, no separate Contracts project, no worker or queue. MediatR, AutoMapper and FluentAssertions were also avoided because they add ceremony and dependency surface without improving correctness or delivery for this small assessment.
- *Tests:* no separate Application test project; handlers are tested through HTTP integration tests, which also cover authorization and persistence.

**SQLite.** One file, no database container, no credentials, nothing to wait for on startup — the most reliable way to get "one command on a clean machine". It's plenty for a 300-student centre where a class of 20 writes answers at the same time. *When I'd move to PostgreSQL:* several app instances, many centres, heavier concurrent writes, or proper backups/replication. The switch is a provider + migration change in Infrastructure.

**One deployable.** ASP.NET Core serves the built React app and the API from the same origin: one container, no CORS, cookie auth works naturally.

**Cookie authentication instead of JWT.** Same origin, so an HttpOnly cookie is simpler and safer than tokens in JavaScript storage, and it survives phone refreshes without a refresh-token scheme. CSRF is mitigated by `SameSite=Strict`, same origin and JSON-only mutation endpoints. `Secure` follows the request scheme so testing over `http://<LAN-IP>` on a real phone works; in production behind HTTPS it would always be secure.

**Server-authoritative everything.** The browser only displays time and results. Eligibility, deadlines, and scores are computed on the server; the timer on the phone is `deadline − server time`.

## 2. Product decisions (gaps in the brief)
| Question the brief leaves open | Decision | Why |
|---|---|---|
| Who creates accounts? | No self-registration. Students, teachers and classes are loaded from CSV files in `seed/`. | A tutoring centre already has its lists; the brief says real data will come as spreadsheets. |
| What do students log in with? | A username like `10a-07`, not email. | Many 15–16-year-olds don't have or use an email; a class-based username is what a centre would hand out. |
| Can one quiz go to several classes? | Yes (10A and 10B are the same grade). | Avoids teachers duplicating the same quiz. |
| Which quizzes can a teacher see? | Only their own, and results only for their own. | Least surprise; each teacher owns their quizzes. |
| Is there an admin role? | Not in this version. | Nothing in the brief needs it yet; it's first on the "next week" list. |
| Student starts close to the closing time | Deadline = the earlier of *start + duration* and *closing time*. The start screen warns: "You'll have only 8 minutes." | Closing time means closing; the warning makes it fair. |
| "Never take a quiz twice" | Enforced by a database unique constraint on (quiz, student). Starting again while an attempt is running **resumes** it. | UI checks can be bypassed and concurrent requests can race; the database can't be. Resuming makes refreshes and dead batteries harmless. |
| Refresh / phone locks / browser closed | The attempt keeps running on the server; every answer is saved the moment it's chosen. Closing the browser is not a submission. | Phones are the main device; losing a quiz to a refresh would be the worst failure. |
| Time runs out without submitting | The attempt is finalized automatically with the saved answers (status "Expired"). Done lazily on the next request that touches it — no background job. | Same result as a scheduler, zero infrastructure. |
| Submit arrives late (slow network) | Not rejected: finalized with what was already saved before the deadline. No answer written after `DeadlineUtc` can affect the score. | Preserves mobile resilience without giving extra quiz time. |
| Negative marking model | Per quiz: a percentage of each question's points is deducted for a wrong answer (e.g. 25 %). 0 % = no negative marking. Unanswered = 0. | Works with per-question points and matches "varies by teacher and by quiz" without per-question settings. |
| Can the total go below zero? | Yes, not clamped. | Clamping makes different performances look identical; a teacher who chose negative marking chose to penalise guessing. The student sees how the score was calculated. |
| When is the score shown? | Right after submitting: score, maximum, percentage, correct/wrong/unanswered. | The brief asks for the score at the end. |
| Show correct answers? | Not while the quiz is still open (classmates may not have taken it). *(Review after closing is stretch S2.)* | Prevents answers leaking inside a class. |
| Editing a quiz after students started | Content is frozen once any attempt exists; unpublish/delete are blocked then. Drafts are fully editable. | Changing a correct answer mid-quiz would make scores unfair and inconsistent. |
| Question/option order | Fixed, as written by the teacher. | Simple and predictable; shuffling is on the next-week list. |
| Navigation during a quiz | Free: any question, answers changeable until submit or time-out. | Mirrors a paper quiz. |
| Time zones | Stored in UTC; shown in the viewer's local time (Amman is UTC+3 all year). | Correct for the centre and for reviewers elsewhere. |
| Points | Whole numbers per question; scores kept to 2 decimals. | Enough for fractional penalties like 25 % of 1 point. |
| Options per question | 2–6, default 4, exactly one correct. | The brief says 4; a little flexibility costs nothing. |
| UI language | English interface; Arabic content fully supported everywhere (per-text direction, Arabic-capable font). | The brief requires Arabic content to work; a full Arabic UI is stretch S4 and the layout is already direction-neutral. |

## 3. Features Nour didn't ask for — and why
- **Autosave + resume** — phones get locked, refreshed, and run out of battery.
- **"Only X minutes left" warning** before starting near the close.
- **Teacher results list students who haven't started or missed the quiz** — that's usually the teacher's first question.
- **Data loaded from CSV files** — ready for the real spreadsheets.
- **Login rate limiting** — cheap protection against guessing demo-style passwords.
- *(fill at the end: any stretch items that got built, e.g. CSV export with a BOM so Excel shows Arabic names.)*

## 4. Deliberately left out
Self-registration and password reset · an admin UI · uploading spreadsheets through the UI · question banks and reuse · shuffling and anti-cheating measures · live dashboards · notifications · multiple centres · audit log · background jobs, queues, caches · browser E2E tests · cloud deployment. Each is reasonable later; none is needed for Nour's first weekly quiz.

## 5. With another week
1. Admin role for Nour: manage classes, students, teachers; reset passwords.
2. Spreadsheet import in the UI (students, teachers, and quizzes from a template), with a preview and validation report.
3. Question bank: reuse questions across quizzes and classes.
4. Per-question analytics (which questions most students got wrong).
5. Optional option/question shuffling per quiz.
6. Full Arabic interface toggle.
7. PostgreSQL + automated backups, HTTPS deployment.
8. Playwright E2E for the student journey on a mobile viewport.

## 6. Known limitations and unfinished work *(fill at the end)*
- …
