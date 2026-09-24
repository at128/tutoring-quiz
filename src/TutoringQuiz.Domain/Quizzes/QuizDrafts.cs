namespace TutoringQuiz.Domain.Quizzes;

/// <summary>
/// Quiz settings as written by a teacher (times in UTC). A wrong answer costs <paramref name="WrongAnswerPenaltyPercent"/>
/// of the question's points, or, when <paramref name="WrongAnswerPenaltyPoints"/> is set, that many points (the
/// percentage is then 0).
/// </summary>
public sealed record QuizDetails(
    string Title,
    string? Description,
    DateTime OpensAtUtc,
    DateTime ClosesAtUtc,
    int DurationMinutes,
    int WrongAnswerPenaltyPercent,
    decimal? WrongAnswerPenaltyPoints = null,
    bool ScoresVisibleToStudents = true);

/// <summary>
/// A question as the teacher wrote it; option order is list order. <paramref name="Id"/> names an existing question
/// to update in place (its students' answers stay attached); without it the question is new.
/// </summary>
public sealed record QuestionDraft(string Text, int Points, IReadOnlyList<OptionDraft> Options, Guid? Id = null);

/// <summary><paramref name="Id"/> names an existing option of the same question to update in place.</summary>
public sealed record OptionDraft(string Text, bool IsCorrect, Guid? Id = null);
