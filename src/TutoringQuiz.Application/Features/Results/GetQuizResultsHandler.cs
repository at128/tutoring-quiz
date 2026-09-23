using Microsoft.EntityFrameworkCore;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Persistence;
using TutoringQuiz.Application.Features.Attempts;
using TutoringQuiz.Application.Features.TeacherQuizzes;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Application.Features.Results;

public sealed class GetQuizResultsHandler(
    IAppDbContext db, TeacherQuizAccess access, AttemptFinalizer finalizer, TimeProvider clock)
{
    public Task<QuizResults> HandleAsync(Guid quizId, CancellationToken ct) =>
        db.RunWithRetryOnConflictAsync(async token =>
        {
            var quiz = await access.OwnedQuizAsync(quizId, token);
            var now = clock.GetUtcNow().UtcDateTime;
            var attempts = await db.QuizAttempts.Include(a => a.Answers)
                .Where(a => a.QuizId == quizId).ToListAsync(token);
            await finalizer.FinalizeExpiredAsync(attempts, _ => quiz, now, token);

            var classIds = quiz.ClassRooms.Select(c => c.ClassRoomId).ToList();
            var classNames = await access.ClassNamesAsync(classIds, token);
            var students = await db.Users.AsNoTracking()
                .Where(u => u.Role == UserRole.Student && u.ClassRoomId.HasValue && classIds.Contains(u.ClassRoomId.Value))
                .ToListAsync(token);
            return QuizResultsPolicy.Build(quiz, students, classNames, attempts, now);
        }, ct);
}
