using TutoringQuiz.Domain.Common;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Domain.Tests;

public sealed class QuizPublishTests
{
    private static readonly DateTime Now = TestQuizzes.Opens.AddDays(-1);

    [Fact] // D11
    public void Publish_WithoutQuestions_IsRejected()
    {
        var draft = Quiz.Create(Guid.NewGuid(), TestQuizzes.Details(), [Guid.NewGuid()], [], Now);

        var error = Assert.Throws<DomainException>(() => draft.Publish(Now));

        Assert.Equal(ErrorCodes.QuizInvalidForPublish, error.Code);
        Assert.Contains("questions", error.Errors!.Keys);
        Assert.False(draft.IsPublished);
    }

    [Fact] // D11
    public void Publish_WithCloseTimeInThePast_IsRejected()
    {
        var quiz = Quiz.Create(Guid.NewGuid(), TestQuizzes.Details(), [Guid.NewGuid()], [TestQuizzes.Question(1)], Now);

        var error = Assert.Throws<DomainException>(() => quiz.Publish(TestQuizzes.Closes));

        Assert.Equal(ErrorCodes.QuizInvalidForPublish, error.Code);
        Assert.Contains("closesAt", error.Errors!.Keys);
    }

    [Theory] // D11
    [InlineData(0)]
    [InlineData(2)]
    public void Questions_WithoutExactlyOneCorrectOption_AreRejected(int correctCount)
    {
        var options = Enumerable.Range(0, 4).Select(i => new OptionDraft($"Option {i}", i < correctCount)).ToList();
        var question = new QuestionDraft("Which one?", 1, options);

        var error = Assert.Throws<DomainException>(() =>
            Quiz.Create(Guid.NewGuid(), TestQuizzes.Details(), [Guid.NewGuid()], [question], Now));

        Assert.Equal(ErrorCodes.ValidationFailed, error.Code);
        Assert.Equal(["Exactly one option must be correct."], error.Errors!["questions[0].options"]);
    }

    [Fact]
    public void Update_OnceStudentsHaveAttempts_IsRejectedAsLocked()
    {
        var quiz = TestQuizzes.Published(0, 1);

        var error = Assert.Throws<DomainException>(() =>
            quiz.Update(TestQuizzes.Details(), [Guid.NewGuid()], [TestQuizzes.Question(2)], hasAttempts: true, Now));

        Assert.Equal(ErrorCodes.QuizLocked, error.Code);
        Assert.Equal(1, quiz.MaxScore);
    }

    [Fact]
    public void UpdatePublished_WithoutQuestions_IsRejectedWithoutChangingContent()
    {
        var quiz = TestQuizzes.Published(0, 1);
        var originalQuestionId = quiz.Questions.Single().Id;

        var error = Assert.Throws<DomainException>(() =>
            quiz.Update(TestQuizzes.Details(), [Guid.NewGuid()], [], hasAttempts: false, Now));

        Assert.Equal(ErrorCodes.QuizInvalidForPublish, error.Code);
        Assert.Contains("questions", error.Errors!.Keys);
        Assert.True(quiz.IsPublished);
        Assert.Equal(originalQuestionId, quiz.Questions.Single().Id);
    }

    [Fact]
    public void UpdateClosedPublished_WithoutAttempts_CanChangeContent()
    {
        var quiz = TestQuizzes.Published(0, 1);
        var afterClose = TestQuizzes.Closes.AddMinutes(1);

        quiz.Update(TestQuizzes.Details(), [Guid.NewGuid()], [TestQuizzes.Question(2)],
            hasAttempts: false, afterClose);

        Assert.True(quiz.IsPublished);
        Assert.Equal(TestQuizzes.Closes, quiz.ClosesAtUtc);
        Assert.Equal(2, quiz.MaxScore);
    }
}
