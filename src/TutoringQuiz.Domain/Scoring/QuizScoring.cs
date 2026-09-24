using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Domain.Scoring;

/// <param name="OptionIds">The question's current options. When given, a choice that isn't one of them (its option
/// was removed after the student chose it) counts as unanswered.</param>
public sealed record ScoringQuestion(
    Guid QuestionId, int Points, Guid CorrectOptionId, IReadOnlyCollection<Guid>? OptionIds = null);

public sealed record ScoreBreakdown(decimal Score, int MaxScore, int CorrectCount, int WrongCount, int UnansweredCount)
{
    public decimal Percentage => QuizScoring.Percentage(Score, MaxScore);
}

public enum AnswerOutcome { Correct, Wrong, Unanswered }

/// <summary>One question's part of a score: what was earned, what was taken back, and the sum of the two.</summary>
public sealed record QuestionScore(
    Guid QuestionId, int Points, Guid? SelectedOptionId, AnswerOutcome Outcome,
    decimal Earned, decimal Deduction, decimal Contribution);

/// <param name="QuestionsTotal">The questions' contributions added up, before the total is kept at 0 or more.</param>
public sealed record ScoreSheet(IReadOnlyList<QuestionScore> Questions, decimal QuestionsTotal, ScoreBreakdown Breakdown);

/// <summary>
/// The only place scores are computed. Per question: correct = +p, wrong = −(the quiz's
/// <see cref="WrongAnswerPenalty"/> for p: p × k / 100, or a fixed amount capped at p), unanswered = 0.
/// The total is rounded to 2 decimals (away from zero) and never goes below 0: wrong answers can take back what
/// correct ones earned, but no more (Atta, 24 Sep). Results, regrading and the teacher's answer view all use this.
/// </summary>
public static class QuizScoring
{
    public static ScoreSheet Explain(
        IEnumerable<ScoringQuestion> questions,
        IReadOnlyDictionary<Guid, Guid?> selectedOptionByQuestion,
        WrongAnswerPenalty penalty)
    {
        var lines = new List<QuestionScore>();
        foreach (var question in questions)
        {
            var selected = selectedOptionByQuestion.GetValueOrDefault(question.QuestionId);
            var counts = selected is { } option && (question.OptionIds is null || question.OptionIds.Contains(option));
            var outcome = !counts ? AnswerOutcome.Unanswered
                : selected == question.CorrectOptionId ? AnswerOutcome.Correct
                : AnswerOutcome.Wrong;
            var earned = outcome == AnswerOutcome.Correct ? question.Points : 0m;
            var deduction = outcome == AnswerOutcome.Wrong ? penalty.DeductionFor(question.Points) : 0m;
            lines.Add(new QuestionScore(question.QuestionId, question.Points, selected, outcome,
                earned, deduction, earned - deduction));
        }

        var total = lines.Sum(line => line.Contribution);
        var breakdown = new ScoreBreakdown(
            Math.Max(0m, Math.Round(total, 2, MidpointRounding.AwayFromZero)),
            lines.Sum(line => line.Points),
            lines.Count(line => line.Outcome == AnswerOutcome.Correct),
            lines.Count(line => line.Outcome == AnswerOutcome.Wrong),
            lines.Count(line => line.Outcome == AnswerOutcome.Unanswered));
        return new ScoreSheet(lines, total, breakdown);
    }

    public static ScoreBreakdown Calculate(
        IEnumerable<ScoringQuestion> questions,
        IReadOnlyDictionary<Guid, Guid?> selectedOptionByQuestion,
        WrongAnswerPenalty penalty) =>
        Explain(questions, selectedOptionByQuestion, penalty).Breakdown;

    /// <summary>A quiz's current questions against a student's answers (answers to removed questions don't count).</summary>
    public static ScoreSheet Explain(
        IEnumerable<Question> questions,
        IEnumerable<AttemptAnswer> answers,
        WrongAnswerPenalty penalty) =>
        Explain(
            questions.Select(q => new ScoringQuestion(q.Id, q.Points, q.CorrectOptionId, [.. q.Options.Select(o => o.Id)])),
            answers.ToDictionary(a => a.QuestionId, a => a.SelectedOptionId),
            penalty);

    public static ScoreBreakdown Calculate(
        IEnumerable<Question> questions,
        IEnumerable<AttemptAnswer> answers,
        WrongAnswerPenalty penalty) =>
        Explain(questions, answers, penalty).Breakdown;

    /// <summary>Score / max × 100, rounded to 1 decimal.</summary>
    public static decimal Percentage(decimal score, int maxScore) =>
        maxScore == 0 ? 0 : Math.Round(score / maxScore * 100m, 1, MidpointRounding.AwayFromZero);
}
