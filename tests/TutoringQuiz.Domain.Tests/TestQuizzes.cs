using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Domain.Tests;

/// <summary>Builds small quizzes with known points; in every question the first option is the correct one.</summary>
internal static class TestQuizzes
{
    public static readonly DateTime Opens = new(2026, 9, 24, 9, 0, 0, DateTimeKind.Utc);
    public static readonly DateTime Closes = new(2026, 9, 24, 12, 0, 0, DateTimeKind.Utc);

    public static QuizDetails Details(int penaltyPercent = 0, int durationMinutes = 20, DateTime? opens = null, DateTime? closes = null) =>
        new("Unit test quiz", null, opens ?? Opens, closes ?? Closes, durationMinutes, penaltyPercent);

    public static QuestionDraft Question(int points, int correctIndex = 0, int optionCount = 4) =>
        new($"Question worth {points}", points,
            Enumerable.Range(0, optionCount).Select(i => new OptionDraft($"Option {i + 1}", i == correctIndex)).ToList());

    public static Quiz Published(int penaltyPercent, params int[] points)
    {
        var quiz = Quiz.Create(
            Guid.NewGuid(),
            Details(penaltyPercent),
            [Guid.NewGuid()],
            points.Select(p => Question(p)).ToList(),
            Opens.AddDays(-1));
        quiz.Publish(Opens.AddDays(-1));
        return quiz;
    }

    public static Guid Correct(this Question question) => question.Options[0].Id;
    public static Guid Wrong(this Question question) => question.Options[1].Id;
}
