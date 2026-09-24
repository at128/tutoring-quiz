using Microsoft.EntityFrameworkCore;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Errors;
using TutoringQuiz.Application.Common.Persistence;
using TutoringQuiz.Application.Features.Attempts;
using TutoringQuiz.Application.Features.TeacherQuizzes;

namespace TutoringQuiz.Application.Features.Results;

/// <summary>
/// A student's answers for the teacher who owns the quiz. Someone else's quiz, or an attempt at another quiz, is
/// indistinguishable from a missing one (404). An attempt past its deadline is finished first, as results do.
/// </summary>
public sealed class GetTeacherAttemptHandler(
    IAppDbContext db, TeacherQuizAccess access, AttemptFinalizer finalizer, TimeProvider clock)
{
    public Task<TeacherAttemptDetail> HandleAsync(Guid quizId, Guid attemptId, CancellationToken ct) =>
        db.RunWithRetryOnConflictAsync(async token =>
        {
            var quiz = await access.OwnedQuizAsync(quizId, token);
            var attempt = await db.QuizAttempts.Include(a => a.Answers)
                .SingleOrDefaultAsync(a => a.Id == attemptId && a.QuizId == quizId, token)
                ?? throw new NotFoundException();
            await finalizer.FinalizeIfExpiredAsync(attempt, quiz, clock.GetUtcNow().UtcDateTime, token);

            var student = await db.Users.AsNoTracking()
                .Where(u => u.Id == attempt.StudentId)
                .Select(u => new { u.Id, u.FullName, u.Username, u.ClassRoomId })
                .SingleAsync(token);
            var className = student.ClassRoomId is { } classId
                ? (await access.ClassNamesAsync([classId], token)).GetValueOrDefault(classId)
                : null;
            return TeacherAttemptViews.Detail(quiz, attempt,
                new TeacherAttemptStudent(student.Id, student.FullName, student.Username, className));
        }, ct);
}
