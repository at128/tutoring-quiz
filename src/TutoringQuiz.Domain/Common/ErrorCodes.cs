namespace TutoringQuiz.Domain.Common;

/// <summary>Machine-readable error codes returned as ProblemDetails "code" (catalogue in docs/API.md).</summary>
public static class ErrorCodes
{
    public const string InvalidCredentials = "auth.invalid_credentials";
    public const string Unauthenticated = "auth.unauthenticated";
    public const string Forbidden = "auth.forbidden";
    public const string RateLimited = "rate_limited";
    public const string ValidationFailed = "validation_failed";
    public const string NotFound = "not_found";
    public const string QuizNotOpenYet = "quiz.not_open_yet";
    public const string QuizClosed = "quiz.closed";
    public const string AttemptAlreadyTaken = "attempt.already_taken";
    public const string AttemptDeadlinePassed = "attempt.deadline_passed";
    public const string AttemptNotInProgress = "attempt.not_in_progress";
    public const string AttemptNotFinalized = "attempt.not_finalized";
    public const string AnswerInvalidOption = "answer.invalid_option";
    public const string QuizLocked = "quiz.locked";
    public const string QuizHasAttempts = "quiz.has_attempts";
    public const string QuizInvalidForPublish = "quiz.invalid_for_publish";
}
