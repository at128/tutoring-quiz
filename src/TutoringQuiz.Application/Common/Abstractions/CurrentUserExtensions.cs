using TutoringQuiz.Application.Common.Errors;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Application.Common.Abstractions;

public static class CurrentUserExtensions
{
    /// <summary>The signed-in student's id and class. Role checks also happen at the endpoint; this is the second line.</summary>
    public static (Guid StudentId, Guid ClassRoomId) RequireStudent(this ICurrentUser user) =>
        user.Role == UserRole.Student && user.ClassRoomId is { } classRoomId
            ? (user.UserId, classRoomId)
            : throw new ForbiddenException("Only students can do this.");

    public static Guid RequireTeacher(this ICurrentUser user) =>
        user.Role == UserRole.Teacher
            ? user.UserId
            : throw new ForbiddenException("Only teachers can do this.");
}
