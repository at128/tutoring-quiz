using Microsoft.EntityFrameworkCore;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Persistence;
using TutoringQuiz.Application.Common.Queries;
using TutoringQuiz.Application.Features.Attempts;
using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Application.Features.StudentQuizzes;

/// <summary>Published quizzes assigned to the student's class, each with its status and the student's attempt.</summary>
public sealed class ListStudentQuizzesHandler(
    IAppDbContext db,
    ICurrentUser currentUser,
    TimeProvider clock,
    AttemptFinalizer finalizer)
{
    public Task<StudentQuizList> HandleAsync(CancellationToken ct) => db.RunWithRetryOnConflictAsync(ExecuteAsync, ct);

    private async Task<StudentQuizList> ExecuteAsync(CancellationToken ct)
    {
        var (studentId, classRoomId) = currentUser.RequireStudent();
        var now = clock.GetUtcNow().UtcDateTime;

        var quizzes = await db.Quizzes.AsNoTracking().VisibleToClass(classRoomId).WithContent().ToListAsync(ct);
        var quizById = quizzes.ToDictionary(q => q.Id);

        var attempts = await LoadAttemptsAsync(studentId, quizById.Keys, ct);
        await finalizer.FinalizeExpiredAsync(attempts, id => quizById[id], now, ct);

        var teacherNames = await LoadTeacherNamesAsync(quizzes, ct);
        return StudentQuizPolicy.BuildList(quizzes, attempts, teacherNames, now);
    }

    private Task<List<QuizAttempt>> LoadAttemptsAsync(Guid studentId, IEnumerable<Guid> quizIds, CancellationToken ct)
    {
        var ids = quizIds.ToList();
        return db.QuizAttempts
            .Include(a => a.Answers)
            .Where(a => a.StudentId == studentId && ids.Contains(a.QuizId))
            .ToListAsync(ct);
    }

    private Task<Dictionary<Guid, string>> LoadTeacherNamesAsync(IEnumerable<Quiz> quizzes, CancellationToken ct)
    {
        var teacherIds = quizzes.Select(q => q.TeacherId).Distinct().ToList();
        return db.Users.AsNoTracking()
            .Where(u => teacherIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id, u => u.FullName, ct);
    }
}
