using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Domain.Attempts;

public sealed class AttemptAnswer : Entity
{
    private AttemptAnswer() { }

    internal AttemptAnswer(Guid attemptId, Guid questionId, Guid? selectedOptionId, DateTime answeredAtUtc)
    {
        AttemptId = attemptId;
        QuestionId = questionId;
        SelectedOptionId = selectedOptionId;
        AnsweredAtUtc = answeredAtUtc;
    }

    public Guid AttemptId { get; private set; }
    public Guid QuestionId { get; private set; }

    /// <summary>Null means the student cleared the answer.</summary>
    public Guid? SelectedOptionId { get; private set; }

    public DateTime AnsweredAtUtc { get; private set; }

    internal void Change(Guid? selectedOptionId, DateTime answeredAtUtc)
    {
        SelectedOptionId = selectedOptionId;
        AnsweredAtUtc = answeredAtUtc;
    }
}
