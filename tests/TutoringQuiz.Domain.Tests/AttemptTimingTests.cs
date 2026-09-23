using TutoringQuiz.Domain.Attempts;

namespace TutoringQuiz.Domain.Tests;

public sealed class AttemptTimingTests
{
    private static readonly DateTime Closes = TestQuizzes.Closes; // 12:00

    [Fact] // D6
    public void Deadline_IsStartPlusDuration_WhenCloseIsLater()
    {
        var start = new DateTime(2026, 9, 24, 10, 0, 0, DateTimeKind.Utc);

        Assert.Equal(start.AddMinutes(20), AttemptTiming.Deadline(start, 20, Closes));
    }

    [Fact] // D7
    public void Deadline_IsCloseTime_WhenStartingNearTheClose()
    {
        var start = new DateTime(2026, 9, 24, 11, 50, 0, DateTimeKind.Utc);

        Assert.Equal(Closes, AttemptTiming.Deadline(start, 20, Closes));
        Assert.Equal(10, AttemptTiming.EffectiveMinutesIfStartedNow(start, 20, Closes));
    }

    [Fact]
    public void Deadline_NearMaximumDate_UsesCloseWithoutOverflow()
    {
        var close = DateTime.SpecifyKind(DateTime.MaxValue, DateTimeKind.Utc);
        var start = close.AddMinutes(-5);

        Assert.Equal(close, AttemptTiming.Deadline(start, 20, close));
        Assert.Equal(5, AttemptTiming.EffectiveMinutesIfStartedNow(start, 20, close));
    }

    [Fact] // D8
    public void IsOpenAt_OpenIsInclusive_CloseIsExclusive()
    {
        var quiz = TestQuizzes.Published(0, 1);

        Assert.False(quiz.IsOpenAt(TestQuizzes.Opens.AddTicks(-1)));
        Assert.True(quiz.IsOpenAt(TestQuizzes.Opens));
        Assert.True(quiz.IsOpenAt(TestQuizzes.Closes.AddTicks(-1)));
        Assert.False(quiz.IsOpenAt(TestQuizzes.Closes));
    }
}
