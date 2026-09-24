using Microsoft.EntityFrameworkCore;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Queries;
using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.Quizzes;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Application.Features.TeacherQuizzes;

public sealed class ListTeacherQuizzesHandler(
    IAppDbContext db, TeacherQuizAccess access, TimeProvider clock)
{
    public async Task<IReadOnlyList<TeacherQuizSummary>> HandleAsync(CancellationToken ct)
    {
        var teacherId = access.TeacherId;
        var now = clock.GetUtcNow().UtcDateTime;
        var quizzes = await db.Quizzes.AsNoTracking().WithContent()
            .Where(q => q.TeacherId == teacherId).ToListAsync(ct);
        if (quizzes.Count == 0) return [];

        var quizIds = quizzes.Select(q => q.Id).ToList();
        var classIds = quizzes.SelectMany(q => q.ClassRooms.Select(c => c.ClassRoomId)).Distinct().ToList();
        var classNames = await access.ClassNamesAsync(classIds, ct);
        var studentClasses = await db.Users.AsNoTracking()
            .Where(u => u.Role == UserRole.Student && u.ClassRoomId.HasValue && classIds.Contains(u.ClassRoomId.Value))
            .Select(u => u.ClassRoomId!.Value).ToListAsync(ct);
        var assignedByClass = studentClasses.GroupBy(id => id)
            .ToDictionary(g => g.Key, g => g.Count());
        var attemptStates = await db.QuizAttempts.AsNoTracking()
            .Where(a => quizIds.Contains(a.QuizId))
            .Select(a => new { a.QuizId, a.Status, a.DeadlineUtc }).ToListAsync(ct);
        // An in-progress attempt past its deadline is already over: count it as finalized, as results do. It becomes
        // Expired on its next read; this list stays read-only.
        var attemptsByQuiz = attemptStates.GroupBy(a => a.QuizId)
            .ToDictionary(g => g.Key, g => new
            {
                Started = g.Count(),
                Finalized = g.Count(a => a.Status != AttemptStatus.InProgress || AttemptTiming.IsPastDeadline(now, a.DeadlineUtc)),
            });

        return quizzes.Select(quiz =>
            {
                var counts = attemptsByQuiz.GetValueOrDefault(quiz.Id);
                var assigned = quiz.ClassRooms.Sum(c => assignedByClass.GetValueOrDefault(c.ClassRoomId));
                return TeacherQuizViews.Summary(quiz, classNames, assigned,
                    counts?.Started ?? 0, counts?.Finalized ?? 0, now);
            })
            .OrderBy(q => StateRank(q.State))
            .ThenBy(q => q.OpensAt)
            .ToList();
    }

    private static int StateRank(TeacherQuizState state) => state switch
    {
        TeacherQuizState.Open => 0,
        TeacherQuizState.Scheduled => 1,
        TeacherQuizState.Draft => 2,
        TeacherQuizState.Closed => 3,
        _ => throw new ArgumentOutOfRangeException(nameof(state)),
    };
}
