using Microsoft.EntityFrameworkCore;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Errors;
using TutoringQuiz.Application.Common.Queries;
using TutoringQuiz.Application.Common.Validation;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Application.Features.TeacherQuizzes;

/// <summary>Shared ownership and class-ID checks; unowned quizzes are indistinguishable from missing ones.</summary>
public sealed class TeacherQuizAccess(IAppDbContext db, ICurrentUser currentUser)
{
    public Guid TeacherId => currentUser.RequireTeacher();

    public async Task<Quiz> OwnedQuizAsync(Guid quizId, CancellationToken ct) =>
        await db.Quizzes.WithContent()
            .SingleOrDefaultAsync(q => q.Id == quizId && q.TeacherId == TeacherId, ct)
        ?? throw new NotFoundException();

    public Task<bool> HasAttemptsAsync(Guid quizId, CancellationToken ct) =>
        db.QuizAttempts.AnyAsync(a => a.QuizId == quizId, ct);

    public async Task<IReadOnlyDictionary<Guid, string>> ValidateClassRoomsAsync(
        IReadOnlyList<Guid> classRoomIds, CancellationToken ct)
    {
        var classes = await db.ClassRooms.AsNoTracking()
            .Where(c => classRoomIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name, ct);
        if (classes.Count != classRoomIds.Count)
            FieldErrors.ThrowIfAny([new FieldError("classRoomIds", "Choose only classes that exist.")]);
        return classes;
    }

    public Task<Dictionary<Guid, string>> ClassNamesAsync(IEnumerable<Guid> ids, CancellationToken ct)
    {
        var distinctIds = ids.Distinct().ToList();
        return db.ClassRooms.AsNoTracking()
            .Where(c => distinctIds.Contains(c.Id))
            .ToDictionaryAsync(c => c.Id, c => c.Name, ct);
    }
}
