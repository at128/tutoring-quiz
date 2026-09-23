namespace TutoringQuiz.Domain.Quizzes;

/// <summary>Quiz settings as written by a teacher (times in UTC).</summary>
public sealed record QuizDetails(
    string Title,
    string? Description,
    DateTime OpensAtUtc,
    DateTime ClosesAtUtc,
    int DurationMinutes,
    int WrongAnswerPenaltyPercent);

/// <summary>A question to create; option order is list order.</summary>
public sealed record QuestionDraft(string Text, int Points, IReadOnlyList<OptionDraft> Options);

public sealed record OptionDraft(string Text, bool IsCorrect);
