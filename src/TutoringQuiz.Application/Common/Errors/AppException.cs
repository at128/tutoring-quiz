using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Application.Common.Errors;

/// <summary>
/// A use case can't go on. <see cref="Code"/> is one of <see cref="ErrorCodes"/>; the API maps it to an HTTP status.
/// The message is the human-readable detail shown to the user.
/// </summary>
public abstract class AppException(string code, string message) : Exception(message)
{
    public string Code { get; } = code;
}

/// <summary>Missing, not owned, not assigned, or unpublished (for students): answered with 404 so nothing leaks.</summary>
public sealed class NotFoundException(string message = "We couldn't find that.")
    : AppException(ErrorCodes.NotFound, message);

public sealed class UnauthenticatedException(string code, string message) : AppException(code, message)
{
    public static UnauthenticatedException InvalidCredentials() =>
        new(ErrorCodes.InvalidCredentials, "The username or password is wrong.");

    public static UnauthenticatedException NotSignedIn() =>
        new(ErrorCodes.Unauthenticated, "Sign in to continue.");
}

public sealed class ForbiddenException(string message = "Your account can't do this.")
    : AppException(ErrorCodes.Forbidden, message);

/// <summary>The request is valid but the current state doesn't allow it (e.g. attempt.already_taken).</summary>
public sealed class ConflictException(string code, string message) : AppException(code, message);

public sealed class ValidationException(IReadOnlyDictionary<string, string[]> errors)
    : AppException(ErrorCodes.ValidationFailed, "Some fields need fixing.")
{
    /// <summary>Field-level problems keyed like the request (e.g. <c>questions[2].options</c>).</summary>
    public IReadOnlyDictionary<string, string[]> Errors { get; } = errors;
}
