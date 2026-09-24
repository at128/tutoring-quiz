namespace TutoringQuiz.Domain.Scoring;

/// <summary>
/// What a wrong answer costs, chosen once per quiz: a percentage of the question's points (0 = no negative
/// marking), or a fixed number of points that is never more than the question is worth. Unanswered costs nothing.
/// </summary>
public readonly record struct WrongAnswerPenalty(int Percent, decimal? Points)
{
    public static WrongAnswerPenalty OfPercent(int percent) => new(percent, null);

    public static WrongAnswerPenalty OfPoints(decimal points) => new(0, points);

    /// <summary>Points taken back for a wrong answer to a question worth <paramref name="questionPoints"/>.</summary>
    public decimal DeductionFor(int questionPoints) =>
        Points is { } points ? Math.Min(points, questionPoints) : questionPoints * (decimal)Percent / 100m;
}
