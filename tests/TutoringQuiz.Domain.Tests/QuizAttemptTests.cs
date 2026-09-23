using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Domain.Tests;

public sealed class QuizAttemptTests
{
    private static readonly DateTime Start = new(2026, 9, 24, 10, 0, 0, DateTimeKind.Utc);

    [Fact] // D9
    public void SaveAnswer_IsAllowedAtTheDeadline_AndRejectedAfterIt_WithoutAffectingTheScore()
    {
        var quiz = TestQuizzes.Published(25, 4, 2);
        var attempt = QuizAttempt.Start(quiz, Guid.NewGuid(), Start);
        var deadline = attempt.DeadlineUtc;

        attempt.SaveAnswer(quiz.Questions[0], quiz.Questions[0].Correct(), deadline);

        var late = Assert.Throws<DomainException>(() =>
            attempt.SaveAnswer(quiz.Questions[1], quiz.Questions[1].Correct(), deadline.AddTicks(1)));
        Assert.Equal(ErrorCodes.AttemptDeadlinePassed, late.Code);

        // A late attempt to change an answer is rejected too.
        Assert.Throws<DomainException>(() =>
            attempt.SaveAnswer(quiz.Questions[0], quiz.Questions[0].Wrong(), deadline.AddSeconds(1)));

        attempt.FinalizeIfExpired(quiz, deadline.AddSeconds(5));

        Assert.Single(attempt.Answers);
        Assert.Equal(4m, attempt.Score);
        Assert.Equal(1, attempt.UnansweredCount);
    }

    [Fact] // D10
    public void Finalize_IsIdempotent_AndLateFinalizationIsExpiredAtTheDeadline()
    {
        var quiz = TestQuizzes.Published(25, 4, 2);
        var attempt = QuizAttempt.Start(quiz, Guid.NewGuid(), Start);
        attempt.SaveAnswer(quiz.Questions[1], quiz.Questions[1].Wrong(), Start.AddMinutes(3));

        Assert.False(attempt.FinalizeIfExpired(quiz, attempt.DeadlineUtc)); // not past the deadline yet
        Assert.True(attempt.FinalizeIfExpired(quiz, attempt.DeadlineUtc.AddHours(2)));

        Assert.Equal(AttemptStatus.Expired, attempt.Status);
        Assert.Equal(attempt.DeadlineUtc, attempt.FinalizedAtUtc);
        Assert.Equal(-0.5m, attempt.Score);

        var version = attempt.Version;
        Assert.False(attempt.FinalizeIfExpired(quiz, attempt.DeadlineUtc.AddHours(3)));
        Assert.False(attempt.Submit(quiz, attempt.DeadlineUtc.AddHours(3)));
        Assert.Equal(AttemptStatus.Expired, attempt.Status);
        Assert.Equal(attempt.DeadlineUtc, attempt.FinalizedAtUtc);
        Assert.Equal(-0.5m, attempt.Score);
        Assert.Equal(version, attempt.Version);
    }

    [Fact]
    public void Submit_BeforeDeadline_IsSubmittedAtNow_AndLateSubmitIsExpiredWithSavedAnswers()
    {
        var quiz = TestQuizzes.Published(0, 3, 2);

        var onTime = QuizAttempt.Start(quiz, Guid.NewGuid(), Start);
        onTime.SaveAnswer(quiz.Questions[0], quiz.Questions[0].Correct(), Start.AddMinutes(1));
        onTime.Submit(quiz, Start.AddMinutes(5));
        Assert.Equal(AttemptStatus.Submitted, onTime.Status);
        Assert.Equal(Start.AddMinutes(5), onTime.FinalizedAtUtc);
        Assert.Equal(3m, onTime.Score);

        var late = QuizAttempt.Start(quiz, Guid.NewGuid(), Start);
        late.SaveAnswer(quiz.Questions[1], quiz.Questions[1].Correct(), Start.AddMinutes(1));
        late.Submit(quiz, late.DeadlineUtc.AddSeconds(30));
        Assert.Equal(AttemptStatus.Expired, late.Status);
        Assert.Equal(late.DeadlineUtc, late.FinalizedAtUtc);
        Assert.Equal(2m, late.Score);
    }

    [Fact]
    public void SaveAnswer_RejectsAnOptionFromAnotherQuestion()
    {
        var quiz = TestQuizzes.Published(0, 1, 1);
        var attempt = QuizAttempt.Start(quiz, Guid.NewGuid(), Start);

        var error = Assert.Throws<DomainException>(() =>
            attempt.SaveAnswer(quiz.Questions[0], quiz.Questions[1].Correct(), Start.AddMinutes(1)));
        Assert.Equal(ErrorCodes.AnswerInvalidOption, error.Code);
    }
}
