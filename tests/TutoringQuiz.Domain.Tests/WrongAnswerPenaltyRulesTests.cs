using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Domain.Tests;

/// <summary>A quiz's wrong-answer cost is a percentage, or a fixed number of points (then the percentage is 0).</summary>
public sealed class WrongAnswerPenaltyRulesTests
{
    private static Dictionary<string, string[]> Validate(int percent, decimal? points) => QuizRules.Validate(
        new QuizDetails("Fractions", null, TestQuizzes.Opens, TestQuizzes.Closes, 20, percent, points),
        [Guid.NewGuid()],
        [TestQuizzes.Question(2)]);

    [Theory]
    [InlineData(0.25)]
    [InlineData(0.5)]
    [InlineData(1)]
    [InlineData(2.75)]
    [InlineData(100)]
    public void AFixedDeductionFromAQuarterPointToTheMaximum_IsValid(double points) =>
        Assert.Empty(Validate(0, (decimal)points));

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(100.01)]
    [InlineData(0.333)] // at most 2 decimals
    public void AFixedDeductionOutOfRange_IsRejected(double points) =>
        Assert.Equal(["wrongAnswerPenaltyPoints"], Validate(0, (decimal)points).Keys);

    [Fact]
    public void APercentageAndAFixedDeductionTogether_AreRejected() =>
        Assert.Equal(["wrongAnswerPenaltyPercent"], Validate(25, 0.5m).Keys);

    [Theory]
    [InlineData(0)]
    [InlineData(25)]
    [InlineData(100)]
    public void APercentageAlone_StaysValid(int percent) => Assert.Empty(Validate(percent, null));
}
