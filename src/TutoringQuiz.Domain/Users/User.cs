using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Domain.Users;

public sealed class User : Entity
{
    public const int UsernameMaxLength = 50;
    public const int FullNameMaxLength = 150;

    private User() { }

    private User(string username, string fullName, UserRole role, string passwordHash, Guid? classRoomId)
    {
        username = username.Trim();
        fullName = fullName.Trim();
        if (username.Length is 0 or > UsernameMaxLength)
            throw new DomainException(ErrorCodes.ValidationFailed, $"Username must be 1–{UsernameMaxLength} characters.");
        if (fullName.Length is 0 or > FullNameMaxLength)
            throw new DomainException(ErrorCodes.ValidationFailed, $"Full name must be 1–{FullNameMaxLength} characters.");

        Username = username;
        UsernameNormalized = Normalize(username);
        FullName = fullName;
        Role = role;
        PasswordHash = passwordHash;
        ClassRoomId = classRoomId;
    }

    public string Username { get; private set; } = null!;
    public string UsernameNormalized { get; private set; } = null!;
    public string FullName { get; private set; } = null!;
    public UserRole Role { get; private set; }
    public string PasswordHash { get; private set; } = null!;

    /// <summary>Students belong to exactly one class; teachers to none.</summary>
    public Guid? ClassRoomId { get; private set; }

    public static User CreateStudent(string username, string fullName, Guid classRoomId, string passwordHash) =>
        new(username, fullName, UserRole.Student, passwordHash, classRoomId);

    public static User CreateTeacher(string username, string fullName, string passwordHash) =>
        new(username, fullName, UserRole.Teacher, passwordHash, classRoomId: null);

    /// <summary>Usernames are compared case-insensitively through this form.</summary>
    public static string Normalize(string username) => username.Trim().ToUpperInvariant();
}
