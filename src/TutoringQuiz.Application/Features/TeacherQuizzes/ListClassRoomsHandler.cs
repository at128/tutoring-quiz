using Microsoft.EntityFrameworkCore;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Application.Features.TeacherQuizzes;

public sealed record TeacherClassRoom(Guid Id, string Name, int StudentCount);

public sealed class ListClassRoomsHandler(IAppDbContext db, ICurrentUser currentUser)
{
    public async Task<IReadOnlyList<TeacherClassRoom>> HandleAsync(CancellationToken ct)
    {
        _ = currentUser.RequireTeacher();
        var classes = await db.ClassRooms.AsNoTracking().OrderBy(c => c.Name).ToListAsync(ct);
        var studentClasses = await db.Users.AsNoTracking()
            .Where(u => u.Role == UserRole.Student)
            .Select(u => u.ClassRoomId)
            .ToListAsync(ct);
        var counts = studentClasses.Where(id => id.HasValue)
            .GroupBy(id => id!.Value).ToDictionary(group => group.Key, group => group.Count());
        return classes.Select(c => new TeacherClassRoom(c.Id, c.Name, counts.GetValueOrDefault(c.Id))).ToList();
    }
}
