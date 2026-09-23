using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Api.ErrorHandling;

/// <summary>HTTP status and title for every error code (docs/API.md → Error codes). The only place codes meet HTTP.</summary>
public static class ErrorCatalog
{
    private static readonly Dictionary<string, (int Status, string Title)> Entries = new()
    {
        [ErrorCodes.InvalidCredentials] = (StatusCodes.Status401Unauthorized, "Wrong username or password"),
        [ErrorCodes.Unauthenticated] = (StatusCodes.Status401Unauthorized, "Not signed in"),
        [ErrorCodes.Forbidden] = (StatusCodes.Status403Forbidden, "Not allowed"),
        [ErrorCodes.RateLimited] = (StatusCodes.Status429TooManyRequests, "Too many attempts"),
        [ErrorCodes.ValidationFailed] = (StatusCodes.Status400BadRequest, "Some fields need fixing"),
        [ErrorCodes.NotFound] = (StatusCodes.Status404NotFound, "Not found"),
        [ErrorCodes.QuizNotOpenYet] = (StatusCodes.Status409Conflict, "Quiz is not open yet"),
        [ErrorCodes.QuizClosed] = (StatusCodes.Status409Conflict, "Quiz is closed"),
        [ErrorCodes.AttemptAlreadyTaken] = (StatusCodes.Status409Conflict, "Quiz already taken"),
        [ErrorCodes.AttemptDeadlinePassed] = (StatusCodes.Status409Conflict, "Time is up"),
        [ErrorCodes.AttemptNotInProgress] = (StatusCodes.Status409Conflict, "Attempt is already finished"),
        [ErrorCodes.AttemptNotFinalized] = (StatusCodes.Status409Conflict, "Attempt is still in progress"),
        [ErrorCodes.AnswerInvalidOption] = (StatusCodes.Status400BadRequest, "Invalid answer"),
        [ErrorCodes.QuizLocked] = (StatusCodes.Status409Conflict, "Quiz is locked"),
        [ErrorCodes.QuizHasAttempts] = (StatusCodes.Status409Conflict, "Quiz has attempts"),
        [ErrorCodes.QuizInvalidForPublish] = (StatusCodes.Status400BadRequest, "Quiz can't be published yet"),
    };

    /// <summary>Unknown codes are treated as business-rule conflicts (409), as ARCHITECTURE.md specifies.</summary>
    public static (int Status, string Title) Lookup(string code) =>
        Entries.TryGetValue(code, out var entry) ? entry : (StatusCodes.Status409Conflict, "Conflict");
}
