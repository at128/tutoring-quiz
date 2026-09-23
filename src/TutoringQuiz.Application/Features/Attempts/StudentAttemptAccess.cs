using Microsoft.EntityFrameworkCore;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Errors;
using TutoringQuiz.Application.Common.Queries;
using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Application.Features.Attempts;

/// <summary>Loads only quizzes and attempts the current student is allowed to see.</summary>
public sealed class StudentAttemptAccess(IAppDbContext db, ICurrentUser currentUser)
{
    public (Guid StudentId, Guid ClassRoomId) Student => currentUser.RequireStudent();

    public async Task<Quiz> VisibleQuizAsync(Guid quizId, Guid classRoomId, CancellationToken ct) =>
        await db.Quizzes.AsNoTracking()
            .VisibleToClass(classRoomId).WithContent()
            .SingleOrDefaultAsync(q => q.Id == quizId, ct)
        ?? throw new NotFoundException();

    public Task<QuizAttempt?> ExistingAttemptAsync(Guid quizId, Guid studentId, CancellationToken ct) =>
        db.QuizAttempts.Include(a => a.Answers)
            .SingleOrDefaultAsync(a => a.QuizId == quizId && a.StudentId == studentId, ct);

    public async Task<(QuizAttempt Attempt, Quiz Quiz)> OwnedAttemptAsync(Guid attemptId, CancellationToken ct)
    {
        var (studentId, classRoomId) = Student;
        var attempt = await db.QuizAttempts.Include(a => a.Answers)
            .SingleOrDefaultAsync(a => a.Id == attemptId && a.StudentId == studentId, ct)
            ?? throw new NotFoundException();
        var quiz = await VisibleQuizAsync(attempt.QuizId, classRoomId, ct);
        return (attempt, quiz);
    }
}
