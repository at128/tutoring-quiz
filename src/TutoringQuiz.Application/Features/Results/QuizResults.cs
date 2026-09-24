using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.Quizzes;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Application.Features.Results;

public enum ResultRowStatus { NotStarted, InProgress, Submitted, Expired, Missed }

public sealed record QuizResultHeader(
    Guid Id, string Title, DateTime OpensAt, DateTime ClosesAt, int DurationMinutes,
    int WrongAnswerPenaltyPercent, decimal? WrongAnswerPenaltyPoints, int MaxScore, TeacherQuizState State,
    bool ScoresVisibleToStudents);

public sealed record QuizResultSummary(
    int AssignedCount, int StartedCount, int FinalizedCount,
    decimal? AverageScore, decimal? HighestScore, decimal? LowestScore, decimal? AveragePercentage);

public sealed record QuizResultRow(
    Guid StudentId, string FullName, string Username, string ClassRoom,
    ResultRowStatus Status, Guid? AttemptId, DateTime? StartedAt, DateTime? FinalizedAt,
    decimal? Score, int MaxScore, decimal? Percentage, DateTime? RegradedAt);

public sealed record QuizResults(
    QuizResultHeader Quiz, QuizResultSummary Summary, IReadOnlyList<QuizResultRow> Rows);

/// <summary>Pure result projection and aggregation; only finalized attempts contribute to statistics.</summary>
internal static class QuizResultsPolicy
{
    public static QuizResults Build(Quiz quiz, IReadOnlyList<User> students,
        IReadOnlyDictionary<Guid, string> classNames, IReadOnlyList<QuizAttempt> attempts, DateTime nowUtc)
    {
        var attemptByStudent = attempts.ToDictionary(a => a.StudentId);
        var rows = students.Select(student =>
            {
                var attempt = attemptByStudent.GetValueOrDefault(student.Id);
                return new QuizResultRow(student.Id, student.FullName, student.Username,
                    classNames[student.ClassRoomId!.Value], Status(attempt, quiz, nowUtc),
                    attempt?.Id, attempt?.StartedAtUtc, attempt?.FinalizedAtUtc,
                    attempt?.Score, attempt?.MaxScore ?? quiz.MaxScore, attempt?.Percentage, attempt?.RegradedAtUtc);
            })
            .OrderBy(row => row.ClassRoom, StringComparer.OrdinalIgnoreCase)
            .ThenBy(row => row.FullName, StringComparer.OrdinalIgnoreCase)
            .ToList();

        var scored = rows.Where(row => row.Score.HasValue).ToList();
        var summary = new QuizResultSummary(rows.Count, rows.Count(row => row.AttemptId.HasValue),
            scored.Count,
            Average(scored.Select(row => row.Score!.Value), 2),
            scored.Count == 0 ? null : scored.Max(row => row.Score),
            scored.Count == 0 ? null : scored.Min(row => row.Score),
            Average(scored.Select(row => row.Percentage!.Value), 1));

        return new QuizResults(new QuizResultHeader(quiz.Id, quiz.Title, quiz.OpensAtUtc, quiz.ClosesAtUtc,
            quiz.DurationMinutes, quiz.WrongAnswerPenaltyPercent, quiz.WrongAnswerPenaltyPoints, quiz.MaxScore, quiz.StateAt(nowUtc),
            quiz.ScoresVisibleToStudents),
            summary, rows);
    }

    private static ResultRowStatus Status(QuizAttempt? attempt, Quiz quiz, DateTime nowUtc) =>
        attempt?.Status switch
        {
            AttemptStatus.InProgress => ResultRowStatus.InProgress,
            AttemptStatus.Submitted => ResultRowStatus.Submitted,
            AttemptStatus.Expired => ResultRowStatus.Expired,
            null when quiz.IsPublished && nowUtc >= quiz.ClosesAtUtc => ResultRowStatus.Missed,
            null => ResultRowStatus.NotStarted,
            _ => throw new ArgumentOutOfRangeException(nameof(attempt)),
        };

    private static decimal? Average(IEnumerable<decimal> values, int places)
    {
        var items = values.ToList();
        return items.Count == 0 ? null : Math.Round(items.Average(), places, MidpointRounding.AwayFromZero);
    }
}
