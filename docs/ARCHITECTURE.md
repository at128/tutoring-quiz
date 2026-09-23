# Architecture

**Style:** Clean Architecture, kept deliberately lean. Four backend projects with enforced dependency direction, one React SPA, one SQLite file, one container.
**Why Clean Architecture here:** the owner expects the product to grow (spreadsheet import, an admin role, more centres, a different database). Clear boundaries make those changes local. **What we refuse to add** because it costs time without paying back at this size: MediatR/CQRS pipelines, generic repositories, AutoMapper, a separate Contracts project, a worker, message queues. (Rationale in `DECISIONS.md`.)

## Solution layout
```
TutoringQuiz.sln
global.json                      # pins the SDK (see "Toolchain")
Directory.Build.props            # nullable, implicit usings, warnings-as-errors for src, LangVersion latest
Directory.Packages.props         # central package versions
src/
  TutoringQuiz.Domain/           # entities, invariants, pure rules. NO package references.
    Common/                      # Entity base, DomainException(code, message)
    ClassRooms/  Users/  Quizzes/  Attempts/
    Scoring/QuizScoring.cs       # pure function: answers + questions + penalty -> ScoreBreakdown
    Attempts/AttemptTiming.cs    # pure function: deadline and status helpers
  TutoringQuiz.Application/      # use cases. References Domain (+ EF Core base package for IAppDbContext/async LINQ).
    Common/
      Abstractions/              # IAppDbContext, ICurrentUser, IPasswordHasher
      Errors/                    # AppException types: NotFound, Forbidden, Conflict, Validation (each carries an error code)
      Options/                   # quiz/application options (no post-deadline answer grace)
    Features/
      Auth/                      # Login, GetCurrentUser
      StudentQuizzes/            # ListStudentQuizzes
      Attempts/                  # StartAttempt, GetAttempt, SaveAnswer, SubmitAttempt, GetAttemptResult, AttemptFinalizer
      TeacherQuizzes/            # List, Get, Create, Update, Publish, Unpublish, Delete, ListClassRooms
      Results/                   # GetQuizResults
    DependencyInjection.cs       # AddApplication()
  TutoringQuiz.Infrastructure/   # EF Core + SQLite, password hashing, seeding. References Application + Domain.
    Persistence/
      AppDbContext.cs            # implements IAppDbContext
      Configurations/            # one IEntityTypeConfiguration per entity (keys, lengths, indexes, delete behaviour)
      Converters/                # UtcDateTimeConverter
      Migrations/
    Security/PasswordHasher.cs   # wraps Microsoft.AspNetCore.Identity.PasswordHasher<T> (Microsoft.Extensions.Identity.Core)
    Seeding/                     # DemoDataSeeder: reads seed/*.csv + seed/quizzes.json, generates demo attempts
    DependencyInjection.cs       # AddInfrastructure(configuration)
  TutoringQuiz.Api/              # composition root + HTTP. References Application + Infrastructure.
    Controllers/                 # thin: bind request -> call handler -> map result
    Auth/                        # cookie setup, CurrentUser (ICurrentUser from HttpContext claims)
    ErrorHandling/               # IExceptionHandler -> RFC 9457 ProblemDetails with "code"
    Program.cs                   # migrate + seed on startup, static SPA hosting, rate limiter
tests/
  TutoringQuiz.Domain.Tests/           # pure unit tests of scoring, timing, invariants
  TutoringQuiz.Api.IntegrationTests/   # WebApplicationFactory + real SQLite file + FakeTimeProvider
frontend/                              # React + TypeScript + Vite (see docs/FRONTEND.md)
seed/                                  # classrooms.csv, teachers.csv, students.csv, quizzes.json
```
No separate Application.Tests project: handlers are exercised through HTTP integration tests, which also cover authorization and persistence. Say this in DECISIONS.md.

## Dependency rules (enforced by project references)
```
Domain          -> (nothing)
Application     -> Domain            (+ Microsoft.EntityFrameworkCore for DbSet/IQueryable async only)
Infrastructure  -> Application, Domain
Api             -> Application, Infrastructure
Tests           -> whatever they test
```
- Domain has no NuGet references and no I/O.
- Application does not reference Infrastructure or ASP.NET Core.
- Controllers contain no business rules: no time checks, no scoring, no ownership checks.
- Pragmatic choice: Application talks to `IAppDbContext` (DbSets + `SaveChangesAsync`) instead of repositories. Document it; it's the common trade-off for this size.

## Use-case pattern (no MediatR)
```csharp
public sealed record StartAttemptCommand(Guid QuizId);

public sealed class StartAttemptHandler(IAppDbContext db, ICurrentUser user, TimeProvider clock, AttemptFinalizer finalizer)
{
    public async Task<StartAttemptResult> HandleAsync(StartAttemptCommand command, CancellationToken ct) { … }
}
```
- One handler class per use case, registered explicitly in `AddApplication()`.
- Controllers inject handlers with `[FromServices]` on the action.
- Request validation: small explicit validator methods (or FluentValidation if it's quicker — pick one and use it everywhere). Validation failures throw `ValidationException(errors)` → 400.
- Business rule failures throw `DomainException(code, message)` → 409 unless the code is listed otherwise in `docs/API.md`.
- Handlers return DTOs defined next to them (`Features/Attempts/AttemptView.cs`). DTOs are records; mapping is hand-written.

## Errors
A single `IExceptionHandler` maps exceptions to ProblemDetails (`application/problem+json`) with an extra `code` property (catalogue in `docs/API.md`). Unknown exceptions → 500 with no stack trace outside Development. Unmatched `/api/*` routes return a 404 ProblemDetails, never `index.html`.

## Persistence (SQLite + EF Core)
- Connection string key `ConnectionStrings:Default`. Docker: `Data Source=/app/data/tutoringquiz.db`. Local dev: `Data Source=tutoringquiz.db` (git-ignored).
- IDs: `Guid` generated in the domain with `Guid.CreateVersion7()`.
- Dates: `DateTime` in UTC only. A value converter marks values read from SQLite as `DateTimeKind.Utc`. Do **not** use `DateTimeOffset` (the SQLite provider can't translate comparisons/ordering on it).
- Money-like values: points are `int`; scores are `decimal` computed in C#. SQLite stores `decimal` as TEXT, so never `SUM`/`ORDER BY` scores in SQL — load the rows (≤ ~60 per quiz) and aggregate in memory.
- Enums stored as strings.
- Required indexes/constraints: unique `Users.UsernameNormalized`; **unique `(QuizAttempts.QuizId, QuizAttempts.StudentId)`**; unique `(AttemptAnswers.AttemptId, AttemptAnswers.QuestionId)`; unique `ClassRooms.Name`; composite key on `QuizClassRooms(QuizId, ClassRoomId)`.
- `QuizAttempt.Version` is an `int` concurrency token (see `docs/DOMAIN.md` → concurrency).
- Detecting a unique violation: catch `DbUpdateException` whose inner `SqliteException` has `SqliteExtendedErrorCode == 2067` (SQLITE_CONSTRAINT_UNIQUE).
- Startup: `Database.MigrateAsync()`, then run `DemoDataSeeder` if `Seed:Enabled` is true **and** there are no users yet.

## Authentication & authorization
- **Cookie authentication** (ASP.NET Core cookie handler), no JWT. Same origin as the SPA, so no tokens in JS storage, and refresh on a phone keeps the session.
- Cookie: name `tq.auth`, `HttpOnly`, `SameSite=Strict`, `SecurePolicy = SameAsRequest` (so http://<LAN-IP>:8080 works when testing on a real phone), sliding expiration, 8 hours.
- API behaviour: `OnRedirectToLogin` → 401 ProblemDetails, `OnRedirectToAccessDenied` → 403. Never redirect an `/api` call.
- CSRF: mitigated by SameSite=Strict + same origin + JSON-only mutation endpoints (a cross-site form can't send `application/json`). Record in DECISIONS.md.
- Claims: `NameIdentifier` (user id), `Name` (username), `Role` (`Student`/`Teacher`), `full_name`, `classroom_id` (students).
- Policies: `[Authorize(Roles = "Student")]` on `/api/student/*`, `[Authorize(Roles = "Teacher")]` on `/api/teacher/*`. Ownership (teacher owns quiz, student owns attempt, student's class is assigned) is checked in handlers and answered with **404** (don't leak existence).
- Passwords hashed with `PasswordHasher<T>`. Usernames compared case-insensitively via `UsernameNormalized` (upper-invariant).
- Login rate limit: built-in ASP.NET Core rate limiter, fixed window 10 requests/minute per IP on `POST /api/auth/login` → 429.

## JSON
camelCase, enums as strings (`JsonStringEnumConverter`), dates ISO-8601 UTC with `Z`. Configure the encoder with `JavaScriptEncoder.Create(UnicodeRanges.All)` so Arabic is readable in responses rather than `\u0627…`.

## Frontend hosting
- Production/Docker: the React build is copied into the API's `wwwroot`. `UseDefaultFiles` + `UseStaticFiles` + `MapFallbackToFile("index.html")` for client routes (after the `/api` 404 rule).
- Development: Vite dev server on 5173 proxies `/api` to 5080 (target overridable with env `API_PROXY_TARGET`). No CORS needed in either mode.

## Runtime (one command)
`docker compose up --build` → http://localhost:8080.
- Multi-stage `Dockerfile`: (1) `node` LTS image → `npm ci && npm run build` in `frontend/`; (2) `mcr.microsoft.com/dotnet/sdk` → restore (copy csproj/props first for layer caching) and `dotnet publish src/TutoringQuiz.Api -c Release -o /app/publish`; (3) `mcr.microsoft.com/dotnet/aspnet` runtime: copy publish output, copy `frontend/dist` → `/app/wwwroot`, copy `seed/` → `/app/seed`.
- Create `/app/data` in the image and give it to the non-root `app` user **before** `USER $APP_UID`, otherwise the named volume isn't writable and SQLite fails on first start.
- `ENV ASPNETCORE_URLS=http://+:8080`, `ConnectionStrings__Default=Data Source=/app/data/tutoringquiz.db`, `Seed__Enabled=true`, `Seed__Path=/app/seed`.
- `docker-compose.yml`: one service, `ports: ["${APP_PORT:-8080}:8080"]`, named volume `tq-data:/app/data`, a healthcheck on `/api/health` is nice-to-have.
- `.dockerignore`: `**/bin`, `**/obj`, `**/node_modules`, `.git`, `*.db`.
- `.gitattributes` with `* text=auto eol=lf` is already in the repo (prevents CRLF problems in Docker on Windows).

## Toolchain
- .NET: target **.NET 10 (LTS)** if `dotnet --list-sdks` shows a 10.x SDK; otherwise .NET 9 and record it in DECISIONS.md. Pin via `global.json` with `rollForward: latestFeature`. Docker image tags must match the target.
- Node: current LTS (22 or 24). Match the Docker `node` image to the local major version.
- CI: `.github/workflows/ci.yml` on push and pull_request to `main`: job `backend` (setup-dotnet using `global-json-file`, restore, build, test), job `frontend` (setup-node, `npm ci`, `npm run lint`, `npm run build`), job `docker` (`docker build .`). It must actually be green on `main` before submission.
