using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Application.Features.Attempts;

public sealed record AttemptOptionView(Guid Id, int Order, string Text);

public sealed record AttemptQuestionView(
    Guid Id, int Order, string Text, int Points,
    IReadOnlyList<AttemptOptionView> Options, Guid? SelectedOptionId);

public sealed record AttemptView(
    Guid Id, Guid QuizId, string QuizTitle, AttemptStatus Status,
    DateTime StartedAt, DateTime Deadline, DateTime ServerNow,
    int WrongAnswerPenaltyPercent, decimal? WrongAnswerPenaltyPoints, int MaxScore,
    IReadOnlyList<AttemptQuestionView> Questions, AttemptResult? Result);

public sealed record ReviewOption(Guid Id, string Text);

public sealed record ReviewItem(
    Guid QuestionId, string Text, int Points, IReadOnlyList<ReviewOption> Options,
    Guid? SelectedOptionId, Guid CorrectOptionId, decimal Earned);

/// <summary>
/// A student's finished attempt. When the teacher hides scores (<see cref="ScoreVisible"/> false) every graded value is
/// null: the score never leaves the server, it isn't merely hidden by the page. Read live from the quiz on each request.
/// </summary>
public sealed record AttemptResult(
    Guid AttemptId, Guid QuizId, string QuizTitle, AttemptStatus Status,
    DateTime StartedAt, DateTime FinalizedAt, bool ScoreVisible,
    decimal? Score, int? MaxScore, decimal? Percentage,
    int? CorrectCount, int? WrongCount, int? UnansweredCount, DateTime? RegradedAt,
    int WrongAnswerPenaltyPercent, decimal? WrongAnswerPenaltyPoints, DateTime ReviewAvailableAt,
    IReadOnlyList<ReviewItem>? Review);

/// <summary>Pure API projections. The in-progress view deliberately has no correct-answer fields.</summary>
internal static class AttemptViews
{
    public static AttemptView ToView(QuizAttempt attempt, Quiz quiz, DateTime nowUtc)
    {
        if (attempt.IsFinalized)
            return new AttemptView(
                attempt.Id, quiz.Id, quiz.Title, attempt.Status,
                attempt.StartedAtUtc, attempt.DeadlineUtc, nowUtc,
                quiz.WrongAnswerPenaltyPercent, quiz.WrongAnswerPenaltyPoints, attempt.MaxScore,
                [], ToResult(attempt, quiz));

        var selectedByQuestion = attempt.Answers.ToDictionary(a => a.QuestionId, a => a.SelectedOptionId);
        var questions = quiz.Questions
            .OrderBy(q => q.Order)
            .Select(q => new AttemptQuestionView(
                q.Id, q.Order, q.Text, q.Points,
                q.Options.OrderBy(o => o.Order)
                    .Select(o => new AttemptOptionView(o.Id, o.Order, o.Text)).ToList(),
                selectedByQuestion.GetValueOrDefault(q.Id)))
            .ToList();

        return new AttemptView(
            attempt.Id, quiz.Id, quiz.Title, attempt.Status,
            attempt.StartedAtUtc, attempt.DeadlineUtc, nowUtc,
            quiz.WrongAnswerPenaltyPercent, quiz.WrongAnswerPenaltyPoints, attempt.MaxScore,
            questions, null);
    }

    public static AttemptResult ToResult(QuizAttempt attempt, Quiz quiz)
    {
        if (!attempt.IsFinalized)
            throw new InvalidOperationException("An in-progress attempt has no result.");

        var finalizedAt = attempt.FinalizedAtUtc ?? throw Missing("finalization time");
        if (!quiz.ScoresVisibleToStudents)
            return new AttemptResult(
                attempt.Id, quiz.Id, quiz.Title, attempt.Status, attempt.StartedAtUtc, finalizedAt, ScoreVisible: false,
                null, null, null, null, null, null, null,
                quiz.WrongAnswerPenaltyPercent, quiz.WrongAnswerPenaltyPoints, quiz.ClosesAtUtc, null);

        return new AttemptResult(
            attempt.Id, quiz.Id, quiz.Title, attempt.Status, attempt.StartedAtUtc, finalizedAt, ScoreVisible: true,
            attempt.Score ?? throw Missing("score"),
            attempt.MaxScore,
            attempt.Percentage ?? throw Missing("percentage"),
            attempt.CorrectCount ?? throw Missing("correct count"),
            attempt.WrongCount ?? throw Missing("wrong count"),
            attempt.UnansweredCount ?? throw Missing("unanswered count"),
            attempt.RegradedAtUtc,
            quiz.WrongAnswerPenaltyPercent, quiz.WrongAnswerPenaltyPoints, quiz.ClosesAtUtc, null);
    }

    private static InvalidOperationException Missing(string field) =>
        new($"Finalized attempt is missing its {field}.");
}
