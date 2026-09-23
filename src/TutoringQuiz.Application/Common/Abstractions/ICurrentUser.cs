using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Application.Common.Abstractions;

/// <summary>The signed-in user, taken from the auth cookie; never from request data.</summary>
public interface ICurrentUser
{
    /// <exception cref="Errors.UnauthenticatedException">No one is signed in.</exception>
    Guid UserId { get; }

    UserRole Role { get; }

    /// <summary>The student's class; null for teachers.</summary>
    Guid? ClassRoomId { get; }
}
