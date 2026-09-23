# Weekly Quizzes — design handoff for Claude Code

Source of truth for behaviour stays `docs/BRIEF.md` → `DECISIONS.md` → `docs/FRONTEND.md` → `docs/DOMAIN.md` → `docs/API.md`. This handoff only adds the visual system and interaction details; where it makes an assumption, it says so.

Direction: **a paper answer sheet moved onto a phone.** White sheets on a quiet desk, ink-blue meaning, filled bubbles for answers, ruled lines for structure. Colour is reserved for time (amber, red), errors (red) and success (green).

## 1. Design tokens

Tailwind v4 (`@import "tailwindcss";` then this in `src/index.css`):

```css
@theme {
  --font-sans: "IBM Plex Sans Arabic", system-ui, "Segoe UI", "Noto Sans Arabic", sans-serif;
  --font-mono: "IBM Plex Mono", ui-monospace, monospace;

  --color-ink: #1D2B4F;        /* text, primary buttons, filled bubbles */
  --color-ink-2: #3C4A6B;      /* secondary text */
  --color-muted: #5A6680;      /* captions, hollow bubble outline */
  --color-paper: #FFFFFF;      /* sheets, cards, bars, inputs */
  --color-desk: #F3F5F9;       /* page background */
  --color-rule: #CBD5E6;       /* borders, ruled separators */
  --color-rule-soft: #E4E9F2;  /* rows inside a sheet, skeletons */
  --color-strong: #9AA8C3;     /* input + secondary button borders */
  --color-tint: #EDF1F9;       /* selected option fill, info */
  --color-focus: #3461D1;      /* focus ring */
  --color-amber: #B7791F;      /* warning borders/icons ONLY */
  --color-amber-ink: #8A5712;  /* warning text */
  --color-amber-bg: #FDF4E3;
  --color-amber-line: #E6C387;
  --color-red: #B42318;
  --color-red-bg: #FDEDEB;
  --color-red-line: #F1B5AE;
  --color-green: #1F7A4D;
  --color-green-bg: #E8F4ED;
  --color-green-line: #A9D5BC;

  --radius-control: 6px;  /* inputs, buttons */
  --radius-option: 8px;   /* answer options, banners */
  --radius-sheet: 10px;   /* cards, sheets */
  --radius-dialog: 12px;
}
```

- **Fonts:** `@fontsource/ibm-plex-sans-arabic` (400, 500, 600, 700) and `@fontsource/ibm-plex-mono` (500, 600), imported in `main.tsx`. Mono is only for the timer, usernames and class codes.
- **Type scale (px/line-height/weight):** display 28/36/700 · page title 22/30/700 · question 20/33/600 (never below 18 on phones) · card title 18/26/700 · option 17/26/400 (500 when selected) · body 16/24 · small 14/20 · meta 13/18/600. Arabic text runs at line-height ≥ 1.6.
- **Spacing:** Tailwind's 4px steps; used values 4, 8, 12, 16, 20, 24, 32, 40, 48. Phone gutter 16, desktop gutter 40.
- **Borders:** 1px `rule` for sheets/cards/bars · 1px `rule-soft` inside sheets · double rule (`border-y` 1px, 4px tall) under a sheet heading · 2px `ink` for selected/emphasised · 2px `red` for errors.
- **Elevation:** none. Only dialogs and the bottom sheet sit on a scrim `rgb(29 43 79 / 0.48)`.
- **Focus:** `outline: 3px solid var(--color-focus); outline-offset: 2px` on `:focus-visible`, everywhere.
- **Contrast:** every text pair ≥ 4.5:1. Amber `#B7791F` is 3.6:1 on white, so it is never used for text — use `amber-ink`.

## 2. Component inventory

Shared (`components/`):
- `PageShell` — desk background, max-width column (student 640, teacher 1200), app bar slot.
- `AppBar` (student: mark + “Weekly Quizzes” or back link, name + class, sign-out icon button; teacher: + “My quizzes” nav) · `BackLink`.
- `Sheet` (paper surface) · `FactRows` (ruled `<dl>`) · `DoubleRule`.
- `Button` — variants `primary | secondary | ghost | danger | dangerGhost`; sizes `lg 48 | md 44 | sm 36`; `loading` (spinner + disabled); renders `<a>` via `asChild`/`to` for links. `IconButton` (44×44, required `aria-label`).
- `Badge` — one component, `kind` prop covering every status (see mapping below). Always icon + word.
- `Auto` (`dir="auto"` wrapper, `<bdi>`-like) · `Num` (`dir="ltr"`, tabular numbers, `unicode-bidi: isolate`).
- `Field` (label, input, hint, error), `TextArea`, `CheckboxCard`, `Segmented` (`aria-pressed` buttons), `Select`.
- `Banner` — `error | warn | info | success | lock`, optional action; `role="alert"` for errors, `status` otherwise.
- `Dialog` (centred, `alertdialog` for confirmations) · `BottomSheet` · `Spinner` · `Skeleton` · `EmptyState` · `ErrorState`.

Student (`features/student/parts`):
- `QuizCard` (status badge, teacher, title, 3-cell facts row, marking line, time hint, action) · `TimeHint` · `ShortTimeWarning` · `ResumeBox`.
- `QuizHeader` = `Timer` + answered count + “Questions” button + `ProgressTicks`.
- `QuestionCard` (“Question 3 of 15”, points pill, text, `AnswerOption` × n, `SaveStatus`, “Clear answer”).
- `AnswerOption` (bubble + text + check; `role="radio"`; roving tabindex, arrow keys) · `Bubble`.
- `QuizFooter` (Previous / Next, or Previous / Submit quiz on the last question).
- `QuestionNavigator` (bottom sheet, 5-column grid of 48px cells, legend, Submit quiz, Leave for now).
- `SubmitDialog` · `TimeUpOverlay` · `ConnectionBanner` · `TimeToast`.
- `ScoreSheet` (big score, %, `CountTrio`, “How this was scored”).

Teacher (`features/teacher/parts`):
- `QuizTable` (≥ md) / `QuizCardTeacher` (< md).
- `DetailsForm` (title, description, `ClassPicker`, opens/closes, duration, `PenaltyPicker`).
- `QuestionEditor` (points, move up/down, delete, text, `OptionEditor` × 2–6, add option) · `QuestionRow` (collapsed).
- `EditorAside` (state, facts, errors, Save/Publish/Unpublish/Delete) · `LockedBanner` · `ReadOnlyQuestion`.
- `ResultsSummary` (6 ruled cells; 3×2 on phones) · `ClassFilter` · `SortSelect` · `ResultsTable` / `ResultCard`.

Badge mapping:

| Status | Icon | Style |
|---|---|---|
| InProgress | half-filled circle | tint fill, strong border, ink |
| Available / Open | filled dot | green-bg, green |
| Upcoming | clock | desk fill, ink-2 |
| Scheduled | calendar | desk fill, ink-2 |
| Completed | check | paper, ink border |
| Submitted | check | green-bg, green |
| Expired | hourglass | amber-bg, amber-ink |
| Missed / Draft | minus-circle / pencil | paper, **dashed** strong border, muted |
| Closed | x | rule-soft fill, ink-2 |
| Locked | lock | paper, rule border, ink-2 |
| NotStarted | hollow circle | paper, muted |

## 3. Responsive behaviour

- **Mobile first at 360.** No horizontal scroll. 16px gutters. Tap targets ≥ 44, answer options ≥ 56, inputs 48 tall with 16px text.
- **Quiz layout:** `h-dvh flex flex-col`; header and footer are `flex-none` (effectively sticky), the question area is the only scroller, so nothing is covered. Footer bottom padding `calc(12px + env(safe-area-inset-bottom))`; add `viewport-fit=cover` to the viewport meta.
- **< 768:** everything one column; teacher list and results as stacked cards; editor footer holds Save draft / Publish.
- **≥ 768 (md):** teacher list and results become ruled tables (`role="table"` or real `<table>`). Student screens remain a single centred column, max 640.
- **≥ 1024 (lg):** editor and locked view get a 300–320px aside (sticky summary + actions).
- **Login:** form is top-aligned (not vertically centred) so the fields and Sign in stay visible with the keyboard open; `scrollIntoView({block: "center"})` on focus.
- **Direction:** UI chrome LTR English. All user text through `Auto`. Numbers next to Arabic through `Num`. Logical utilities only (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`, `text-start`).
- **Motion:** spinner, 150ms colour transitions, skeleton pulse — all disabled under `prefers-reduced-motion`.

## 4. Interaction and state notes

Quiz taking:
- Tapping an option selects it immediately (optimistic), shows **Saving…**, then **Saved ✓**. Tapping the selected option again does nothing; **Clear answer** sends `selectedOptionId: null`.
- On a failed PUT: keep the selection, show **Not saved yet — retrying** on that question, a red `ConnectionBanner` (“Connection lost — retrying. Answers already saved are safe. N answers are waiting to be sent.” + Retry now), mark the tick and navigator cell with “!”. Retry with backoff (1s, 2s, 4s, max 8s) and on `online`. `beforeunload` only while the queue is non-empty.
- Timer: `remaining = deadline − (Date.now() + offset)`, rendered m:ss (h:mm:ss above 60 min). Normal > 5:00, amber ≤ 5:00, red ≤ 1:00, solid red at 0:00. A one-off toast + `aria-live="polite"` at 5 min and 1 min. Resync on `visibilitychange`.
- At 0:00: disable all answer controls immediately, stop retrying or sending any locally pending answer saves, and show an overlay: “Time’s up — submitting your saved answers”. Call submit/finalize immediately; the server scores only answers that were successfully persisted at or before `DeadlineUtc`. Any locally pending/unsaved answer is not counted. Then `navigate(result, { replace: true })`. `deadline_passed` / `not_in_progress` → result page.
- Navigator: bottom sheet (focus trapped, Esc and scrim close). Cell = answered (filled), not answered (hollow), current (ring), not saved (“!”). Includes Submit quiz and **Leave for now** (answers saved, timer keeps running).
- Submit: from footer on the last question and from the navigator. Dialog lists unanswered question numbers and the marking rule. While time remains, if the queue has items: “1 answer is waiting to be sent. It will be sent before submitting.” Primary disabled + spinner while pending. If `DeadlineUtc` is reached first, stop pending retries/sends and finalize immediately; only answers already persisted by the server are counted.
- No auto-advance after answering: the student moves with Next (prevents accidental taps landing on the next question).

Start screen:
- `Available` → facts + “If you start now: the full 20 minutes, until 10:32”. When `effectiveMinutesIfStartedNow < durationMinutes`: amber `ShortTimeWarning` at the top and the button reads “Start quiz — 8 minutes”. The same warning appears on the list card.
- `InProgress` → `ResumeBox` (remaining time from `attempt.deadline`) + “Resume quiz”. `Upcoming` → info banner + disabled “Opens in 2 days”. `Completed` → score + “View result” (also where `attempt.already_taken` lands). `Missed` → no action.
- Start errors: `quiz.not_open_yet` / `quiz.closed` → refresh the list data and show the matching state; 404 → Not available.

Result:
- Score, max and percentage in `Num`; negative totals in red with a leading real minus sign (U+2212). `CountTrio`. “How this was scored” explains the rule. `Expired` adds an amber banner “Time ran out — your saved answers were submitted automatically.”

Teacher:
- Editor validates inline as the server does (title 3–200, description ≤ 1000, duration 1–180, closes > opens, ≥ 1 class; question text, points 1–100, 2–6 options, exactly one correct). Server `errors` keys (`questions[2].options`) map to the matching field or question; a summary banner in the aside (desktop) or top (mobile) says how many problems.
- Collapsed question rows expand in place (one expanded at a time on phones).
- Draft → Save draft + Publish. Published and unlocked → Save changes + Unpublish + Delete. Locked → read-only view, lock banner, Unpublish/Delete disabled with reason.
- `quiz.locked` on save → error banner “Your changes weren’t saved…” + Reload quiz.
- Results: summary is for the whole quiz (API); class filter and sort are client-side over `rows`. Status badges per row; score `—` when not finalized.

Loading / empty / error: skeletons in the final card shape; empty states say what will appear and when; errors say what happened and what to do, with Try again.

## 5. Assumptions and flagged conflicts

Design assumptions (not in the specs):
1. Product name in the UI: **“Weekly Quizzes”**, subtitle “Tutoring centre · Amman”.
2. **Clear answer** link on each question (the API supports `null`; with negative marking a student may want to un-guess).
3. **Leave for now** in the navigator, with the note that the timer keeps running.
4. **Progress ticks** under the header (one per question). Decorative duplicate of the answered count; `aria-hidden`.
5. No auto-advance after selecting an option.
6. Empty student groups are hidden; group order follows the API order.
7. The start page for `Upcoming` quizzes is viewable but has no start action.
8. Teacher results filter shows the summary for all classes (the API summary is not per class).
9. Editor questions collapse to one line; move up/down via icon buttons (no drag and drop).
10. Date format `Thu 8 Oct, 10:00` (`Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })`), shown in the viewer’s local time.

Conflicts / gaps to know about:
- **Negative-marking impact on the result.** The prompt asks for it, but `AttemptResult` gives counts and the penalty %, not the points deducted (the wrong questions’ points are unknown). The design explains the rule and counts instead of showing an exact deduction. An exact breakdown needs `review` (stretch S2) or a new `penaltyPoints` field — an API change needing approval.
- **Amber #B7791F** from FRONTEND.md fails 4.5:1 for text; kept for borders/icons, text uses `#8A5712`.
- **StudentQuizCard has no class list**; the start screen shows the student’s own class (from `CurrentUser`).
- **List API has no answered count** for in-progress attempts, so cards and the resume box don’t claim “5 of 15 answered”.
- **Seed coverage:** no single seed student has all five list states, and no teacher owns all four quiz states. The canvas shows two 10B accounts side by side, and the desktop teacher list is a composite (flagged on the canvas). The “only 8 minutes” frame uses an illustrative close time.
- Button copy follows FRONTEND.md sentence case (“Start quiz”), not “Start Quiz”.

## 6. Build order for Claude Code

1. Tokens (`@theme`), fonts, `index.css` base (focus ring, reduced motion) + `Button`, `IconButton`, `Badge`, `Auto`, `Num`, `Sheet`, `Banner`, `Spinner`.
2. **TakeQuizPage:** `QuizHeader` + `Timer` (server offset) → `QuestionCard` + `AnswerOption` + `SaveStatus` → `QuizFooter`. Test at 360 with Arabic and English quizzes.
3. Autosave queue + `ConnectionBanner`, then `SubmitDialog`, `TimeToast`s and `TimeUpOverlay`.
4. `QuestionNavigator` bottom sheet.
5. **StartQuizPage** (Available, short-time warning, Resume, Upcoming, Completed).
6. **ResultPage** (Submitted, Expired, negative score).
7. **Student QuizListPage** (`QuizCard`, groups, loading/empty/error).
8. **LoginPage** (error, rate limit, keyboard-open layout).
9. **Teacher ResultsPage** (summary, filter, sort, table ≥ md, cards < md).
10. **Teacher QuizEditorPage** (DetailsForm, QuestionEditor, validation mapping) + locked read-only view.
11. **Teacher QuizListPage** (table/cards).
12. Remaining 404 / not-available / 409 states and polish.
