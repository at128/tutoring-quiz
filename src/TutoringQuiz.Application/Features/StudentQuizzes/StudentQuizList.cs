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
    decimal? WrongAnswerPenaltyPoints,
    StudentQuizStatus Status,
    int? EffectiveMinutesIfStartedNow,
    StudentAttemptSummary? Attempt);

/// <summary><see cref="Score"/> is null while the attempt runs, and whenever the teacher hides scores.</summary>
public sealed record StudentAttemptSummary(Guid Id, AttemptStatus Status, DateTime Deadline, bool ScoreVisible, decimal? Score, int MaxScore);
