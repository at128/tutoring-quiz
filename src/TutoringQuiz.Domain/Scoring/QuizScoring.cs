using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Domain.Scoring;

public sealed record ScoringQuestion(Guid QuestionId, int Points, Guid CorrectOptionId);

public sealed record ScoreBreakdown(decimal Score, int MaxScore, int CorrectCount, int WrongCount, int UnansweredCount)
{
    public decimal Percentage => QuizScoring.Percentage(Score, MaxScore);
}

/// <summary>
/// The only place scores are computed. Per question: correct = +p, wrong = −p × k / 100, unanswered = 0.
/// The total is rounded to 2 decimals (away from zero) and is not clamped, so it can be negative.
/// </summary>
public static class QuizScoring
{
    public static ScoreBreakdown Calculate(
        IEnumerable<ScoringQuestion> questions,
        IReadOnlyDictionary<Guid, Guid?> selectedOptionByQuestion,
        int wrongAnswerPenaltyPercent)
    {
        decimal total = 0;
        int maxScore = 0, correct = 0, wrong = 0, unanswered = 0;

        foreach (var question in questions)
        {
            maxScore += question.Points;
            if (!selectedOptionByQuestion.TryGetValue(question.QuestionId, out var selected) || selected is null)
            {
                unanswered++;
            }
            else if (selected == question.CorrectOptionId)
            {
                correct++;
                total += question.Points;
            }
            else
            {
                wrong++;
                total -= question.Points * (decimal)wrongAnswerPenaltyPercent / 100m;
            }
        }

        return new ScoreBreakdown(
            Math.Round(total, 2, MidpointRounding.AwayFromZero), maxScore, correct, wrong, unanswered);
    }

    public static ScoreBreakdown Calculate(
        IEnumerable<Question> questions,
        IEnumerable<AttemptAnswer> answers,
        int wrongAnswerPenaltyPercent) =>
        Calculate(
            questions.Select(q => new ScoringQuestion(q.Id, q.Points, q.CorrectOptionId)),
            answers.ToDictionary(a => a.QuestionId, a => a.SelectedOptionId),
            wrongAnswerPenaltyPercent);

    /// <summary>Score / max × 100, rounded to 1 decimal (can be negative).</summary>
    public static decimal Percentage(decimal score, int maxScore) =>
        maxScore == 0 ? 0 : Math.Round(score / maxScore * 100m, 1, MidpointRounding.AwayFromZero);
}
