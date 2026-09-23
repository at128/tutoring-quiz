using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Application.Features.StudentQuizzes;

/// <summary>Pure rules for the student's quiz list: status per quiz, the card shape, and the list order.</summary>
public static class StudentQuizPolicy
{
    /// <summary>Call only after expired attempts were finalized, so an in-progress attempt is still running.</summary>
    public static StudentQuizStatus StatusOf(Quiz quiz, QuizAttempt? attempt, DateTime nowUtc) => attempt switch
    {
        { IsFinalized: true } => StudentQuizStatus.Completed,
        not null => StudentQuizStatus.InProgress,
        null when nowUtc < quiz.OpensAtUtc => StudentQuizStatus.Upcoming,
        null when nowUtc >= quiz.ClosesAtUtc => StudentQuizStatus.Missed,
        _ => StudentQuizStatus.Available,
    };

    public static StudentQuizList BuildList(
        IEnumerable<Quiz> quizzes,
        IEnumerable<QuizAttempt> attempts,
        IReadOnlyDictionary<Guid, string> teacherNames,
        DateTime nowUtc)
    {
        var attemptByQuiz = attempts.ToDictionary(a => a.QuizId);
        var cards = quizzes
            .Select(quiz => new Entry(quiz, attemptByQuiz.GetValueOrDefault(quiz.Id)))
            .Select(entry => entry with { Status = StatusOf(entry.Quiz, entry.Attempt, nowUtc) })
            .OrderBy(SortKey)
            .ThenBy(entry => entry.Quiz.Title, StringComparer.CurrentCulture)
            .Select(entry => ToCard(entry, teacherNames.GetValueOrDefault(entry.Quiz.TeacherId) ?? "", nowUtc))
            .ToList();

        return new StudentQuizList(nowUtc, cards);
    }

    private sealed record Entry(Quiz Quiz, QuizAttempt? Attempt, StudentQuizStatus Status = default);

    /// <summary>
    /// InProgress (deadline soonest) → Available (closing soonest) → Upcoming (opening soonest) →
    /// Completed (most recent first) → Missed (most recent first). Negative ticks sort descending.
    /// </summary>
    private static (int Group, long Key) SortKey(Entry entry) => entry.Status switch
    {
        StudentQuizStatus.InProgress => (0, entry.Attempt!.DeadlineUtc.Ticks),
        StudentQuizStatus.Available => (1, entry.Quiz.ClosesAtUtc.Ticks),
        StudentQuizStatus.Upcoming => (2, entry.Quiz.OpensAtUtc.Ticks),
        StudentQuizStatus.Completed => (3, -(entry.Attempt!.FinalizedAtUtc ?? entry.Attempt.DeadlineUtc).Ticks),
        _ => (4, -entry.Quiz.ClosesAtUtc.Ticks),
    };

    private static StudentQuizCard ToCard(Entry entry, string teacherName, DateTime nowUtc)
    {
        var (quiz, attempt, status) = entry;
        return new StudentQuizCard(
            quiz.Id,
            quiz.Title,
            quiz.Description,
            teacherName,
            quiz.OpensAtUtc,
            quiz.ClosesAtUtc,
            quiz.DurationMinutes,
            quiz.Questions.Count,
            quiz.MaxScore,
            quiz.WrongAnswerPenaltyPercent,
            status,
            status == StudentQuizStatus.Available
                ? AttemptTiming.EffectiveMinutesIfStartedNow(nowUtc, quiz.DurationMinutes, quiz.ClosesAtUtc)
                : null,
            attempt is null
                ? null
                : new StudentAttemptSummary(attempt.Id, attempt.Status, attempt.DeadlineUtc, attempt.Score, attempt.MaxScore));
    }
}
