using TutoringQuiz.Domain.Attempts;

namespace TutoringQuiz.Application.Features.StudentQuizzes;

public enum StudentQuizStatus
{
    Upcoming,
    Available,
    InProgress,
    Completed,
    Missed,
}

/// <summary>API shape <c>StudentQuizList</c>.</summary>
public sealed record StudentQuizList(DateTime ServerNow, IReadOnlyList<StudentQuizCard> Quizzes);

/// <summary>API shape <c>StudentQuizCard</c>.</summary>
public sealed record StudentQuizCard(
    Guid Id,
    string Title,
    string? Description,
    string TeacherName,
    DateTime OpensAt,
    DateTime ClosesAt,
    int DurationMinutes,
    int QuestionCount,
    int MaxScore,
    int WrongAnswerPenaltyPercent,
    StudentQuizStatus Status,
    int? EffectiveMinutesIfStartedNow,
    StudentAttemptSummary? Attempt);

public sealed record StudentAttemptSummary(Guid Id, AttemptStatus Status, DateTime Deadline, decimal? Score, int MaxScore);
