# Frontend specification

Implementation owner: Claude Code. Lives in `frontend/`. Talks only to the API in `docs/API.md`. Codex reviews the frontend independently at checkpoints.

## Stack (keep it small)
React + TypeScript (strict) + Vite, Tailwind CSS, React Router, TanStack Query, React Hook Form for the quiz editor. ESLint via the Vite template. No UI kit, no Redux, no Playwright. Use the latest stable versions and their current setup docs (e.g. Tailwind's Vite plugin).

## Structure
```
frontend/src/
  api/          client.ts (fetch wrapper), types.ts (mirrors docs/API.md), auth.ts, student.ts, teacher.ts
  auth/         AuthProvider (GET /api/auth/me), RequireRole
  components/   Button, Card, Badge, Dialog, Spinner, EmptyState, ErrorState, Auto (dir="auto" text wrapper), PageShell
  features/student/  QuizListPage, StartQuizPage, TakeQuizPage, ResultPage, parts/{Timer, QuestionCard, QuestionNavigator, SaveStatus}
  features/teacher/  QuizListPage, QuizEditorPage, ResultsPage
  lib/          time.ts (server-clock offset, countdown, formatting), dir.ts
  routes.tsx, main.tsx, index.css
```

## API client rules
- `fetch` with `credentials: "same-origin"` and JSON headers. Parse ProblemDetails into `ApiError { status, code, title, detail, errors }`.
- 401 anywhere → clear the cached user and go to `/login?returnTo=<path>`.
- UI decisions use `code`, not message text (e.g. `attempt.already_taken` → "You've already taken this quiz").
- Never compute scores, eligibility or deadlines in the browser beyond what's needed to *display* them.

## Routes
| Path | Who | Page |
|---|---|---|
| `/login` | anyone | username + password; after login go to `returnTo` or the role home |
| `/` | any | redirect by role |
| `/student` | Student | quiz list grouped by status |
| `/student/quizzes/:quizId` | Student | start screen: title, teacher, question count, max score, negative-marking explanation, effective time, "Start quiz" |
| `/student/attempts/:attemptId` | Student | take quiz |
| `/student/attempts/:attemptId/result` | Student | result |
| `/teacher` | Teacher | my quizzes with state badges and counts |
| `/teacher/quizzes/new`, `/teacher/quizzes/:id/edit` | Teacher | quiz editor |
| `/teacher/quizzes/:id/results` | Teacher | results |
| `*` | any | not found |

## Taking a quiz (the most important screen — design for a 360 px phone first)
- **Header (sticky):** quiz title, countdown `mm:ss`, answered progress `7 / 15`. Countdown turns amber under 5 min and red under 1 min; announce "5 minutes left" / "1 minute left" once via `aria-live="polite"`.
- **Server clock:** on every AttemptView response compute `offset = serverNow − Date.now()`; remaining = `deadline − (Date.now() + offset)`. Re-fetch the attempt on `visibilitychange` → visible (phone unlocked, tab switched back) to resync time and answers.
- **One question per screen**: "Question 3 of 15 · 2 points", question text, options as full-width buttons (min height 48 px, 16 px+ text) with radiogroup semantics; the selected option looks like a filled bubble on an answer sheet. Option labels: Arabic letters أ ب ج د when the question text is Arabic, A B C D otherwise.
- **Navigation:** Previous / Next in a sticky footer (respect `env(safe-area-inset-bottom)`), plus a question grid (sheet/drawer) showing answered / unanswered / current. Answers can change until submit.
- **Autosave:** selecting an option immediately `PUT`s it. Show per-question status: saving · saved ✓ · failed. On failure retry with backoff and show a banner "Connection lost — retrying. Answers already saved are safe." Keep a small queue of unsent answers; flush it before submit.
- **Submit:** button in the footer on the last question and in the grid. Confirm dialog shows the number of unanswered questions and the negative-marking rule. Disable while pending (no double submit). After success `navigate(result, { replace: true })` so Back doesn't return to the quiz.
- **Time's up:** at 0 flush the queue and call submit automatically; the server finalizes regardless. If the server answers `attempt.deadline_passed` / `not_in_progress`, go to the result page.
- **Resume:** opening `/student/quizzes/:quizId` for an in-progress quiz shows "Resume quiz" and the remaining time.
- Don't block navigation with `beforeunload` (answers are already on the server), except while the queue has unsent answers.

## Other pages
- **Student list:** cards per quiz with status badge, times shown in the viewer's local time (`Intl.DateTimeFormat`), "closes in 2 days" hints, and for `Available` quizzes whose effective time is shorter than the duration: "You'll have only 8 minutes — the quiz closes at 11:00."
- **Result:** score / max, percentage, correct · wrong · unanswered counts, how negative marking affected the score, status note if `Expired` ("Time ran out — your saved answers were submitted automatically.").
- **Teacher editor:** title, description, classes (checkboxes), opens/closes (`datetime-local`, converted to UTC ISO on save), duration, negative marking (None / 25 % / 33 % / 50 % / custom), question list with add, delete, move up/down; each question: text (textarea, `dir="auto"`), points, options (default 4, 2–6), one correct (radio). Inline validation mirroring the server rules; server `errors` mapped onto fields. "Save draft" and "Publish". When `isLocked`: read-only view with a banner explaining why.
- **Teacher results:** summary tiles (assigned, finalized, average, highest, lowest), filter by class, sort by name/score; a table on ≥ md screens, stacked cards on phones. Status badges for NotStarted / InProgress / Submitted / Expired / Missed.
- Every data view has explicit loading, empty and error states. Errors say what happened and what to do; they don't apologise.

## Arabic and direction
- UI chrome is English (decision). All user-generated text (names, titles, questions, options, descriptions) is rendered with `dir="auto"` (use the `Auto` component or `<bdi>`), including inside inputs and textareas.
- Use Tailwind **logical** utilities everywhere (`ms-*`, `me-*`, `ps-*`, `pe-*`, `start-*`, `end-*`, `text-start`) — never `ml/mr/pl/pr/left/right` for layout. This keeps a future Arabic UI toggle (stretch S4) cheap.
- Numbers next to Arabic text: render scores in their own element with `dir="ltr"` so `−1.5` doesn't display as `1.5−`.
- Font: one family that covers Arabic and Latin (e.g. IBM Plex Sans Arabic or Noto Sans Arabic), self-hosted via an `@fontsource` package so it works offline in Docker; system fallback stack.

## Mobile checklist
No horizontal scroll at 360 px · tap targets ≥ 44 px · inputs ≥ 16 px font (prevents iOS zoom) · sticky header/footer don't cover content · safe-area insets · visible focus rings · works in portrait with the keyboard open on the login page · `prefers-reduced-motion` respected.

## Visual direction
The subject is a paper quiz moving to the phone, so borrow from the answer sheet rather than generic SaaS dashboards: white "paper" surfaces, ink-blue text and actions, filled bubbles for selected answers, clear ruled separators.
- Palette: ink `#1D2B4F` (primary, text on light), paper `#FFFFFF`, desk `#F3F5F9` (page background), rule `#CBD5E6` (borders), pencil-amber `#B7791F` (timer warning), margin-red `#B42318` (errors, last minute), pass-green `#1F7A4D` (saved/success).
- Type: one family (above); clear scale (e.g. 14/16/18/22/28); question text ≥ 18 px on phones.
- Avoid: all-caps eyebrow labels, gradient washes, identical shadowed cards for everything, decorative motion. Motion only to confirm an action (answer saved, submit).
- Copy: plain verbs and consistent names — the button "Submit quiz" leads to the toast "Quiz submitted". Sentence case.
