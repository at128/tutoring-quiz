using TutoringQuiz.Application.Common.Validation;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Application.Features.Auth;

/// <summary>Body of <c>POST /api/auth/login</c>. Fields are nullable because the client may omit them.</summary>
public sealed record LoginCommand(string? Username, string? Password);

/// <summary>Credentials that passed validation.</summary>
internal sealed record Credentials(string Username, string Password);

internal static class LoginValidator
{
    /// <summary>Upper bound so a huge "password" can't turn hashing into a denial of service.</summary>
    public const int PasswordMaxLength = 128;

    public static Credentials Validate(LoginCommand command)
    {
        FieldErrors.ThrowIfAny(Errors(command));
        return new Credentials(command.Username!.Trim(), command.Password!);
    }

    private static IEnumerable<FieldError> Errors(LoginCommand command) =>
    [
        .. FieldErrors.When(string.IsNullOrWhiteSpace(command.Username), "username", "Enter your username."),
        .. FieldErrors.When(command.Username?.Trim().Length > User.UsernameMaxLength, "username",
            $"Usernames are at most {User.UsernameMaxLength} characters."),
        .. FieldErrors.When(string.IsNullOrEmpty(command.Password), "password", "Enter your password."),
        .. FieldErrors.When(command.Password?.Length > PasswordMaxLength, "password",
            $"Passwords are at most {PasswordMaxLength} characters."),
    ];
}
