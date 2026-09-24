# Decisions

Nour wasn't available for questions, so every gap in the brief was decided here. Each entry says what I chose, why, and what I'd reconsider. Sections marked *(fill at the end)* are completed before submission.

## 1. Architecture

**Clean Architecture, deliberately lean.** Four backend projects (Domain, Application, Infrastructure, Api) with dependency direction enforced by project references.
- *Why:* I expect this product to grow — spreadsheet import, an admin role for Nour, more centres, possibly PostgreSQL. With the business rules (scoring, timing, one-attempt) isolated in a dependency-free Domain and use cases in Application, those changes stay local.
- *Trade-off I accepted:* for 300 students a single project with vertical slices would be faster to write. I kept the boundaries but refused the usual ceremony: no MediatR or pipeline behaviours, no generic repositories (Application uses an `IAppDbContext` interface), no AutoMapper, no separate Contracts project, no worker or queue. MediatR, AutoMapper and FluentAssertions were also avoided because they add ceremony and dependency surface without improving correctness or delivery for this small assessment.
- *Tests:* no separate Application test project; handlers are tested through HTTP integration tests, which also cover authorization and persistence.

**SQLite.** One file, no database container, no credentials, nothing to wait for on startup — the most reliable way to get "one command on a clean machine". It's plenty for a 300-student centre where a class of 20 writes answers at the same time. *When I'd move to PostgreSQL:* several app instances, many centres, heavier concurrent writes, or proper backups/replication. The switch is a provider + migration change in Infrastructure.

**One deployable.** ASP.NET Core serves the built React app and the API from the same origin: one container, no CORS, cookie auth works naturally.

**Cookie authentication instead of JWT.** Same origin, so an HttpOnly cookie is simpler and safer than tokens in JavaScript storage, and it survives phone refreshes without a refresh-token scheme. CSRF is mitigated by `SameSite=Strict`, same origin and JSON-only mutation endpoints. `Secure` follows the request scheme, so testing over `http://<LAN-IP>` on a real phone works. Behind HTTPS (the live demo) the cookie is `Secure`, because the proxy's forwarded scheme is trusted there.

**Toolchain: .NET 9, oxlint.** The plan preferred .NET 10 (LTS), but the development machine only has the .NET 9 SDK, so the solution targets `net9.0` (pinned in `global.json` with `rollForward: latestFeature`; Docker uses the matching `9.0` images). Moving to .NET 10 means changing `TargetFramework` in `Directory.Build.props`, the SDK in `global.json` and the Docker tags. The frontend linter is **oxlint**, because that's what the current Vite template ships (the plan said ESLint, which older templates used); `npm run lint` is still the gate.

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
| UI language | **Arabic and English interface.** The language follows the device (an Arabic phone gets Arabic), and a «العربية / English» button on the sign-in page and in the top bar switches in place and is remembered on that device. Arabic is fully right-to-left with Western digits 0-9, the month names يناير, فبراير…, and real Arabic plurals. Numbers inside Arabic sentences are isolated, so "−0.5" or "25%" never flip. Content keeps its own direction either way. | The brief requires Arabic content to work. Atta then asked (24 Sep) for the whole experience to be Arabic, since most students and teachers use Arabic phones. English stays for reviewers. |

## 3. Features Nour didn't ask for — and why
- **Autosave + resume** — phones get locked, refreshed, and run out of battery.
- **"Only X minutes left" warning** before starting near the close.
- **Teacher results list students who haven't started or missed the quiz** — that's usually the teacher's first question.
- **Data loaded from CSV files** — ready for the real spreadsheets.
- **Login rate limiting**: cheap protection against guessing demo-style passwords. It limits **per IP + username** (10/min), plus a loose per-IP cap (100/min). A class signing in together from the centre's Wi-Fi shares one IP; a plain per-IP limit (the first plan) would have locked half of them out at the start of a quiz.
- **Screens that don't go stale.** While a page stays open:
  - on the student's list and start screen, a quiz becomes available or closes at its time, and the remaining time is recounted;
  - the teacher's list refetches at the next opening or closing.
  The server still decides whether a start is allowed. In the last minute, the warning says "less than 1 minute", not "0 minutes".
- **The editor never shifts a time silently.** Impossible dates (30 Feb) and times skipped by a daylight-saving jump are rejected. Saving a quiz keeps its stored times to the second until the teacher changes them.
- **A live demo that updates itself**: https://quiz.just-atta.site. The server pulls each commit of `main` whose CI passed, builds it and swaps it in, rolling back if the health check fails. It publishes no new port, and nothing about the server (keys, addresses, secrets) is stored on GitHub. See `deploy/README.md`. This is reviewer convenience; `docker compose up --build` stays the way to run the project.
- **Stretch S4, the Arabic interface, was built** at Atta's request (see §2, UI language). No other stretch items (S1–S3, S5) were built.
- **Text that shows nothing counts as empty.** A title, question or option made only of spaces, tatweel (ـ), diacritics or invisible marks (ZWNJ, RLM…) is rejected with the same rule on the server and in the browser.

## 4. Deliberately left out
Self-registration and password reset · an admin UI · uploading spreadsheets through the UI · question banks and reuse · shuffling and anti-cheating measures · live dashboards · notifications · multiple centres · audit log · background jobs, queues, caches · browser E2E tests in CI · production hosting (the live demo is one self-updating container on a shared server, for reviewers). Each is reasonable later; none is needed for Nour's first weekly quiz.

## 5. With another week
1. Admin role for Nour: manage classes, students, teachers; reset passwords.
2. Spreadsheet import in the UI (students, teachers, and quizzes from a template), with a preview and validation report.
3. Question bank: reuse questions across quizzes and classes.
4. Per-question analytics (which questions most students got wrong).
5. Optional option/question shuffling per quiz.
6. Server messages in Arabic. The interface already translates every error by its code, but server field messages are English.
7. Production hosting: PostgreSQL, automated backups and monitoring (HTTPS hosting already exists as the live demo).
8. Playwright E2E for the student journey on a mobile viewport.

## 6. Known limitations and unfinished work *(completed after the M4 review)*
- **One SQLite file, one app instance.** Fine for one centre. Backups aren't automated (copy the volume). Several instances would need PostgreSQL (see §1).
- **Login limits count every attempt:** 10/min per IP + username and 100/min per IP. A very large centre behind one public IP could reach the per-IP cap; it's configurable (`RateLimiting:*`).
- **The live demo is shared.** Anyone with the published demo passwords can use it. An admin resets it on the server (`tq-deploy reset-demo`). Its quiz dates are relative to the last reset, so after about 14 days every demo quiz has closed until the next reset.
- **Browser journeys aren't automated.** The frontend has unit tests of its logic (answers/autosave, timer, server clock, editor validation, results sorting). The full journeys were driven with Playwright scripts during development, at 360 px and on desktop, outside the repo and not in CI (§4).
- **Native date/time pickers follow the device.** On an Arabic phone, the browser’s own date picker may show Arabic-Indic digits; everything the app writes uses 0-9.
- *(M4 findings that are accepted but not fixed are listed here after triage.)*
