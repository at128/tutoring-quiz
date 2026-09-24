using TutoringQuiz.Domain.Scoring;

namespace TutoringQuiz.Domain.Tests;

public sealed class QuizScoringTests
{
    // Worked example from docs/DOMAIN.md: questions worth 4, 2, 2, 1 (max 9).
    private static readonly ScoringQuestion[] Questions =
    [
        new(Guid.NewGuid(), 4, Guid.NewGuid()),
        new(Guid.NewGuid(), 2, Guid.NewGuid()),
        new(Guid.NewGuid(), 2, Guid.NewGuid()),
        new(Guid.NewGuid(), 1, Guid.NewGuid()),
    ];

    private static Guid? CorrectFor(int i) => Questions[i].CorrectOptionId;
    private static Guid? WrongFor(int _) => Guid.NewGuid();

    // correct, wrong, unanswered (no row), wrong
    private static Dictionary<Guid, Guid?> MixedAnswers() => new()
    {
        [Questions[0].QuestionId] = CorrectFor(0),
        [Questions[1].QuestionId] = WrongFor(1),
        [Questions[3].QuestionId] = WrongFor(3),
    };

    [Fact] // D1
    public void Calculate_WithoutPenalty_OnlyCorrectAnswersCount()
    {
        var result = QuizScoring.Calculate(Questions, MixedAnswers(), WrongAnswerPenalty.OfPercent(0));

        Assert.Equal(4m, result.Score);
        Assert.Equal(9, result.MaxScore);
        Assert.Equal(44.4m, result.Percentage);
        Assert.Equal((1, 2, 1), (result.CorrectCount, result.WrongCount, result.UnansweredCount));
    }

    [Fact] // D2
    public void Calculate_WithQuarterPenalty_MatchesWorkedExample()
    {
        var result = QuizScoring.Calculate(Questions, MixedAnswers(), WrongAnswerPenalty.OfPercent(25));

        Assert.Equal(3.25m, result.Score);
        Assert.Equal(36.1m, result.Percentage);
    }

    [Fact] // D3
    public void Calculate_UnansweredIsZeroEvenWithPenalty_ForMissingRowAndNullOption()
    {
        var answers = new Dictionary<Guid, Guid?>
        {
            [Questions[0].QuestionId] = null, // cleared answer
            // Questions[1..3]: no row at all
        };

        var result = QuizScoring.Calculate(Questions, answers, WrongAnswerPenalty.OfPercent(50));

        Assert.Equal(0m, result.Score);
        Assert.Equal(4, result.UnansweredCount);
        Assert.Equal(0, result.WrongCount);
    }

    [Fact] // D4
    public void Calculate_AllWrongWithHalfPenalty_StopsAtZero()
    {
        var answers = Questions.ToDictionary(q => q.QuestionId, q => WrongFor(0));

        var result = QuizScoring.Calculate(Questions, answers, WrongAnswerPenalty.OfPercent(50));

        Assert.Equal(0m, result.Score); // −4.5 before the floor
        Assert.Equal(0m, result.Percentage);
        Assert.Equal(Questions.Length, result.WrongCount);
    }

    [Fact]
    public void Calculate_DeductionsLargerThanTheEarnedPoints_StopAtZero_WhileSmallerOnesStillCount()
    {
        ScoringQuestion[] questions = [new(Guid.NewGuid(), 1, Guid.NewGuid()), new(Guid.NewGuid(), 6, Guid.NewGuid())];

        var tooMuch = QuizScoring.Calculate(questions, new Dictionary<Guid, Guid?>
        {
            [questions[0].QuestionId] = questions[0].CorrectOptionId, // +1
            [questions[1].QuestionId] = Guid.NewGuid(), // −3
        }, WrongAnswerPenalty.OfPercent(50));
        Assert.Equal((0m, 0m, 1, 1), (tooMuch.Score, tooMuch.Percentage, tooMuch.CorrectCount, tooMuch.WrongCount));

        var justEnough = QuizScoring.Calculate(questions, new Dictionary<Guid, Guid?>
        {
            [questions[0].QuestionId] = Guid.NewGuid(), // −0.25
            [questions[1].QuestionId] = questions[1].CorrectOptionId, // +6
        }, WrongAnswerPenalty.OfPercent(25));
        Assert.Equal(5.75m, justEnough.Score);
    }

    [Fact] // D5
    public void Calculate_RoundsScoreToTwoDecimalsAndPercentageAwayFromZero()
    {
        ScoringQuestion[] questions =
        [
            new(Guid.NewGuid(), 1, Guid.NewGuid()),
            new(Guid.NewGuid(), 1, Guid.NewGuid()),
            new(Guid.NewGuid(), 6, Guid.NewGuid()),
        ];

        // +1 − 33 % of 1 point.
        var thirdOfAPoint = QuizScoring.Calculate(questions, new Dictionary<Guid, Guid?>
        {
            [questions[0].QuestionId] = questions[0].CorrectOptionId,
            [questions[1].QuestionId] = Guid.NewGuid(),
        }, WrongAnswerPenalty.OfPercent(33));
        Assert.Equal(0.67m, thirdOfAPoint.Score);
        Assert.Equal(2, thirdOfAPoint.Score.Scale);

        // +1 − 0.5 = 0.5 of 8 → 6.25 % → 6.3 (away from zero, not banker's 6.2).
        var positiveMidpoint = QuizScoring.Calculate(questions, new Dictionary<Guid, Guid?>
        {
            [questions[0].QuestionId] = questions[0].CorrectOptionId,
            [questions[1].QuestionId] = Guid.NewGuid(),
        }, WrongAnswerPenalty.OfPercent(50));
        Assert.Equal(0.5m, positiveMidpoint.Score);
        Assert.Equal(6.3m, positiveMidpoint.Percentage);

        // +6 − 0.5 = 5.5 of 8 → 68.75 % → 68.8 (away from zero).
        var upperMidpoint = QuizScoring.Calculate(questions, new Dictionary<Guid, Guid?>
        {
            [questions[0].QuestionId] = Guid.NewGuid(),
            [questions[2].QuestionId] = questions[2].CorrectOptionId,
        }, WrongAnswerPenalty.OfPercent(50));
        Assert.Equal(5.5m, upperMidpoint.Score);
        Assert.Equal(68.8m, upperMidpoint.Percentage);
    }

    [Fact]
    public void Calculate_FixedPointsPerWrongAnswer_TakesThatAmountForEachWrongAnswer()
    {
        // correct 4, wrong on 2 points, unanswered, wrong on 1 point: 4 − 0.5 − 0.5
        var result = QuizScoring.Calculate(Questions, MixedAnswers(), WrongAnswerPenalty.OfPoints(0.5m));

        Assert.Equal(3m, result.Score);
        Assert.Equal((1, 2, 1), (result.CorrectCount, result.WrongCount, result.UnansweredCount));
    }

    [Fact]
    public void Calculate_FixedPoints_NeverTakeMoreThanTheQuestionIsWorth()
    {
        // correct 4, wrong on 2 points (−1.5), wrong on 1 point (−1.5 capped at −1): 4 − 1.5 − 1
        var result = QuizScoring.Calculate(Questions, MixedAnswers(), WrongAnswerPenalty.OfPoints(1.5m));

        Assert.Equal(1.5m, result.Score);
    }

    [Fact]
    public void Calculate_FixedPointsLargerThanEverythingEarned_StopAtZero()
    {
        var answers = Questions.ToDictionary(q => q.QuestionId, q => WrongFor(0));

        var result = QuizScoring.Calculate(Questions, answers, WrongAnswerPenalty.OfPoints(100m));

        Assert.Equal(0m, result.Score);
    }

    [Theory]
    [InlineData(4, 0.5, 0.5)]
    [InlineData(1, 0.5, 0.5)]
    [InlineData(1, 1, 1)]
    [InlineData(1, 2, 1)] // capped at the question's points
    [InlineData(3, 99.99, 3)]
    public void FixedDeduction_IsTheAmount_CappedAtTheQuestionsPoints(int questionPoints, double fixedPoints, double expected) =>
        Assert.Equal((decimal)expected, WrongAnswerPenalty.OfPoints((decimal)fixedPoints).DeductionFor(questionPoints));

    [Theory]
    [InlineData(4, 25, 1)]
    [InlineData(1, 33, 0.33)]
    [InlineData(2, 100, 2)]
    [InlineData(3, 0, 0)]
    public void PercentDeduction_IsThatShareOfTheQuestionsPoints(int questionPoints, int percent, double expected) =>
        Assert.Equal((decimal)expected, WrongAnswerPenalty.OfPercent(percent).DeductionFor(questionPoints));
}
