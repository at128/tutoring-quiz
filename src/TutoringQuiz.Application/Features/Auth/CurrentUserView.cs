using Microsoft.EntityFrameworkCore;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Views;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Application.Features.Auth;

/// <summary>API shape <c>CurrentUser</c>.</summary>
public sealed record CurrentUserView(Guid Id, string Username, string FullName, UserRole Role, ClassRoomRef? ClassRoom);

internal static class CurrentUserQueries
{
    /// <summary>The user with their class (students) projected straight to the view; null when the user is gone.</summary>
    public static Task<CurrentUserView?> FindCurrentUserViewAsync(this IAppDbContext db, Guid userId, CancellationToken ct) =>
        (from user in db.Users.AsNoTracking()
         where user.Id == userId
         join classRoom in db.ClassRooms.AsNoTracking() on user.ClassRoomId equals (Guid?)classRoom.Id into classRooms
         from classRoom in classRooms.DefaultIfEmpty()
         select new CurrentUserView(
             user.Id,
             user.Username,
             user.FullName,
             user.Role,
             classRoom == null ? null : new ClassRoomRef(classRoom.Id, classRoom.Name)))
        .SingleOrDefaultAsync(ct);
}
