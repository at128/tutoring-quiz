using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.Common;
using TutoringQuiz.Domain.Quizzes;
using TutoringQuiz.Domain.Scoring;

namespace TutoringQuiz.Domain.Tests;

public sealed class QuizRegradeDomainTests
{
    private static readonly DateTime Started = TestQuizzes.Opens.AddMinutes(5);
    private static readonly DateTime AfterClose = TestQuizzes.Closes.AddSeconds(1);

    [Fact]
    public void UpdateWithHistory_PreservesIdsAndMarksRemovedQuestionsAndOptions()
    {
        var quiz = TestQuizzes.Published(25, 4, 2);
        var first = quiz.Questions[0];
        var removedQuestion = quiz.Questions[1];
        var removedOption = first.Options[0];
        var retainedOption = first.Options[1];
        var newDraft = new QuestionDraft("Rewritten", 6,
            [new OptionDraft("New correct", true, retainedOption.Id), new OptionDraft("New wrong", false)], first.Id);

        quiz.Update(TestQuizzes.Details(50), ClassIds(quiz), [newDraft], hasAttempts: true, AfterClose);

        Assert.Single(quiz.Questions);
        Assert.Same(first, quiz.Questions[0]);
        Assert.Equal(first.Id, quiz.Questions[0].Id);
        Assert.Equal(6, first.Points);
        Assert.Equal("Rewritten", first.Text);
        Assert.True(removedQuestion.IsRemoved);
        Assert.Equal(AfterClose, removedQuestion.RemovedAtUtc);
        Assert.True(removedOption.IsRemoved);
        Assert.Equal(AfterClose, removedOption.RemovedAtUtc);
        Assert.Same(removedOption, first.FindOption(removedOption.Id));
        Assert.Equal(retainedOption.Id, first.Options[0].Id);
        Assert.True(first.Options[0].IsCorrect);
        Assert.NotEqual(removedOption.Id, first.Options[1].Id);
        Assert.Equal(6, quiz.MaxScore);
    }

    [Fact]
    public void UpdateWithoutHistory_HardRemovesOldQuestionAndOption()
    {
        var quiz = TestQuizzes.Published(0, 4, 2);
        var first = quiz.Questions[0];
        var oldQuestion = quiz.Questions[1];
        var oldOption = first.Options[1];
        quiz.Update(TestQuizzes.Details(), ClassIds(quiz),
            [new QuestionDraft(first.Text, 4, [new OptionDraft("Right", true, first.Options[0].Id),
                new OptionDraft("Replacement", false)], first.Id)], hasAttempts: false, Started);

        Assert.Single(quiz.Questions);
        Assert.DoesNotContain(quiz.Questions, q => q.Id == oldQuestion.Id);
        Assert.False(oldQuestion.IsRemoved); // removed from aggregate, not soft-deleted
        Assert.Null(first.FindOption(oldOption.Id));
        Assert.Equal(first.Id, quiz.Questions[0].Id);
    }

    [Fact]
    public void ClosedEditCannotChangeScheduleOrClasses_AndAtCloseInstantStillLocked()
    {
        var quiz = TestQuizzes.Published(0, 4);
        var draft = Drafts(quiz);
        Assert.Equal(ErrorCodes.QuizLocked, Assert.Throws<DomainException>(() =>
            quiz.Update(TestQuizzes.Details(), ClassIds(quiz), draft, true, TestQuizzes.Closes)).Code);
        Assert.Equal(ErrorCodes.QuizLocked, Assert.Throws<DomainException>(() =>
            quiz.Update(TestQuizzes.Details(closes: TestQuizzes.Closes.AddSeconds(1)), ClassIds(quiz), draft, true, AfterClose)).Code);
        Assert.Equal(ErrorCodes.QuizLocked, Assert.Throws<DomainException>(() =>
            quiz.Update(TestQuizzes.Details(), [Guid.NewGuid()], draft, true, AfterClose)).Code);
        Assert.Equal(4, quiz.MaxScore);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void RegradeKeepsFinalStatusTimesAndSelections_AndOnlyStampsActualChanges(bool expired)
    {
        var quiz = TestQuizzes.Published(25, 4, 2);
        var attempt = QuizAttempt.Start(quiz, Guid.NewGuid(), Started);
        var chosen = quiz.Questions[0].Correct();
        attempt.SaveAnswer(quiz.Questions[0], chosen, Started.AddMinutes(1));
        if (expired) attempt.FinalizeIfExpired(quiz, attempt.DeadlineUtc.AddTicks(1));
        else attempt.Submit(quiz, Started.AddMinutes(2));
        var status = attempt.Status;
        var started = attempt.StartedAtUtc;
        var finalized = attempt.FinalizedAtUtc;
        var deadline = attempt.DeadlineUtc;
        var version = attempt.Version;
        Assert.False(attempt.Regrade(quiz, AfterClose));
        Assert.Null(attempt.RegradedAtUtc);
        Assert.Equal(version, attempt.Version);

        var first = quiz.Questions[0];
        quiz.Update(TestQuizzes.Details(50), ClassIds(quiz),
            [new QuestionDraft(first.Text, 6,
                first.Options.Select(o => new OptionDraft(o.Text, o.IsCorrect, o.Id)).ToList(), first.Id),
             Drafts(quiz)[1]], true, AfterClose);
        Assert.True(attempt.Regrade(quiz, AfterClose));
        Assert.Equal(6m, attempt.Score);
        Assert.Equal(8, attempt.MaxScore);
        Assert.Equal(AfterClose, attempt.RegradedAtUtc);
        Assert.Equal(status, attempt.Status);
        Assert.Equal(started, attempt.StartedAtUtc);
        Assert.Equal(finalized, attempt.FinalizedAtUtc);
        Assert.Equal(deadline, attempt.DeadlineUtc);
        Assert.Equal(chosen, Assert.Single(attempt.Answers).SelectedOptionId);
        var next = AfterClose.AddMinutes(1);
        Assert.False(attempt.Regrade(quiz, next));
        Assert.Equal(AfterClose, attempt.RegradedAtUtc);
    }

    [Fact]
    public void Explain_LinesSumToQuestionsTotal_AndFloorOnlyAppliesToFinalScore()
    {
        var correct = Guid.NewGuid();
        var wrong = Guid.NewGuid();
        var removed = Guid.NewGuid();
        var q1 = Guid.NewGuid();
        var q2 = Guid.NewGuid();
        var q3 = Guid.NewGuid();
        var sheet = QuizScoring.Explain(
            [new ScoringQuestion(q1, 4, correct, [correct, wrong]),
             new ScoringQuestion(q2, 2, correct, [correct, wrong]),
             new ScoringQuestion(q3, 1, correct, [correct, wrong])],
            new Dictionary<Guid, Guid?> { [q1] = wrong, [q2] = wrong, [q3] = removed },
            new WrongAnswerPenalty(0, 5m));

        Assert.Equal(-6m, sheet.QuestionsTotal);
        Assert.Equal(sheet.Questions.Sum(line => line.Contribution), sheet.QuestionsTotal);
        Assert.Equal(0m, sheet.Breakdown.Score);
        Assert.Equal(7, sheet.Breakdown.MaxScore);
        Assert.Equal(2, sheet.Breakdown.WrongCount);
        Assert.Equal(1, sheet.Breakdown.UnansweredCount);
        Assert.Equal(4m, sheet.Questions[0].Deduction);
        Assert.Equal(2m, sheet.Questions[1].Deduction);
        Assert.Equal(0m, sheet.Questions[2].Deduction);
        Assert.Equal(removed, sheet.Questions[2].SelectedOptionId);
        Assert.Equal(AnswerOutcome.Unanswered, sheet.Questions[2].Outcome);
    }

    private static Guid[] ClassIds(Quiz quiz) => quiz.ClassRooms.Select(c => c.ClassRoomId).ToArray();

    private static QuestionDraft[] Drafts(Quiz quiz) => quiz.Questions.Select(q =>
        new QuestionDraft(q.Text, q.Points, q.Options.Select(o => new OptionDraft(o.Text, o.IsCorrect, o.Id)).ToArray(), q.Id)).ToArray();
}
