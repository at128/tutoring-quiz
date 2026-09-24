# M4 — Codex adversarial whole-repo review (2026-09-24)

Scope: committed `main` at `7edd165` (after the handler-audit merge), backend Domain/Application/Infrastructure/API, persistence and HTTP tests, student and teacher workflows, Docker/CI configuration, and delivery docs. Claude's Arabic UI conversion was uncommitted and changing during this review; it is **not** signed off here. No implementation files were changed in this review.

## Findings for Atta to triage

| ID | Severity | Where | Concrete failure scenario | Suggested fix |
|---|---|---|---|---|
| M4-01 | major (security) | `src/TutoringQuiz.Api/Auth/AuthSetup.cs:27`; `src/TutoringQuiz.Api/Controllers/TeacherQuizzesController.cs:44-49`, `StudentAttemptsController.cs:21,48`; `docs/ARCHITECTURE.md:98` | The security rationale says mutations are JSON-only, but bodyless publish/unpublish/start/submit POSTs accept a plain HTML form and have no Origin/antiforgery check. `SameSite=Strict` distinguishes *sites*, not sibling origins. If a logged-in teacher visits an untrusted page on another `*.just-atta.site` subdomain, that page can POST to a known quiz ID with the cookie and publish/unpublish it without reading the response. A student can similarly be made to start/submit a known attempt. | Enforce same-origin/antiforgery protection for **every unsafe method**, including bodyless actions; update the documented CSRF rationale and add a cross-origin request regression. |
| M4-02 | major | `frontend/src/features/teacher/QuizEditorPage.tsx:87-98,145-149` | Open a valid unpublished quiz before its close time, leave the editor open until after it closes, then press **Publish**. `save()` correctly validates against `Date.now()` and returns, but the displayed `problems` revalidates against `openedAt`; no error appears, so the button looks broken. | Use the same current validation timestamp for the action and the displayed problems (store the action's validation result, or update a validation clock); test this transition. |
| M4-03 | major | `frontend/src/features/teacher/QuizEditorPage.tsx:47,77`; `frontend/src/features/teacher/editor/DetailsSection.tsx:58-82` | Let `GET /api/teacher/classrooms` fail after the query retries (e.g. a transient outage) on **New quiz**. Only `classRooms.data` is passed down, and `undefined` always renders a skeleton, even in the terminal error state. There is no error or retry control; the teacher cannot choose a class and create the quiz until reloading the page. | Render a classroom-query error with retry, distinct from its pending skeleton; test failed-then-recovered loading. |
| M4-04 | minor | `src/TutoringQuiz.Application/Features/TeacherQuizzes/ListTeacherQuizzesHandler.cs:29-34`; `frontend/src/features/teacher/teacherCopy.ts` | A student starts a quiz and closes the browser; after the attempt deadline, the teacher list still counts that stored `InProgress` row as not finalized until someone opens student list/attempt or teacher results. A closed quiz can display `0 of 20 finalized` even though all attempts have timed out. | Either finalize expired attempts before building the teacher-list counts or label the counts as stored/possibly pending and refresh after results finalization. Add a clock-advance integration test if changing behavior. |

## Checked and found sound

- One-attempt uniqueness is enforced by a database index; start/resume handles duplicate writes. Answer saves and submissions use server time and stored answers, with deadline checks, finalization and score calculation in Domain/Application. Existing race/ownership/score tests exercise these paths.
- Student responses in progress project option IDs/text without `isCorrect`; teacher ownership and student class/attempt ownership are checked in handlers. Stale cookies are checked against the current user role/class before authorization.
- The seed graph is built before its single `SaveChangesAsync`, and startup applies migrations; the Docker image includes the SPA, seed files, a writable data volume and persisted Data Protection keys. Deployment config enables forwarded headers behind TLS termination. I reviewed these files but did not independently run Docker in M4.
- `dotnet test TutoringQuiz.sln -c Release --no-restore --no-build` passed in this review: **20 Domain + 58 API/SQLite integration tests**. I did not run frontend checks against Claude's in-progress Arabic changes or a browser journey; those need validation after his i18n PR and the newly approved E2E job.

Finite test suites cannot prove every edge case. These are the additional reproducible risks found beyond the earlier handler audit; no change is authorized until Atta triages each ID.

Update from coordination: Claude reports M4-02 and M4-03 fixed in his in-progress Arabic UI branch. I inspected the uncommitted `checkedAt` validation path and the classroom error/retry branch; both address the scenarios in this report. They still need automated and browser verification after that branch lands. M4-01 and M4-04 remain for Atta's triage.

## Outcome (24 Sep)

Atta accepted all four findings and the blank-text rule raised during M4. Codex reached its usage limit before implementing them, so Claude Code made the fixes and committed Codex's browser tests.

| ID | Fix | Regression tests |
|---|---|---|
| M4-01 | `Auth/SameOriginGuard.cs`: an `/api` change (any method but GET/HEAD/OPTIONS/TRACE) whose `Sec-Fetch-Site` isn't `same-origin`, or, without it, whose `Origin` differs from the site, gets 403 `auth.forbidden`. | `SameOriginTests`: cross-site/same-site/none publish, a foreign or `null` Origin form-post to start, cross-site sign-in, same-origin still works, a table of the guard's decisions |
| M4-02 | The editor checks against the time of the last Save/Publish (`checkedAt`), PR #12 | `e2e/editorRecovery.e2e.ts` (fake browser clock moved past the close) |
| M4-03 | A failed class list shows an error with Try again, PR #12 | `e2e/editorRecovery.e2e.ts` (class list fails, then recovers) |
| M4-04 | The teacher list counts an in-progress attempt past its deadline as finalized (read-only, like results) | `TeacherWorkflowTests.QuizList_CountsAnAbandonedAttemptAsFinalized_OnceItsDeadlinePasses` |
| Blank text | `Domain/Common/VisibleText.cs` and the editor's `isBlank`: only spaces, controls, format marks, combining marks and tatweel count as empty | `VisibleTextTests`, `ArabicContentTests`, `e2e/teacher.e2e.ts` (Arabic editor) |
