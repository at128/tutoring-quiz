using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Domain.Quizzes;

public sealed class Option : Entity
{
    private Option() { }

    internal Option(Guid questionId, int order, OptionDraft draft)
    {
        QuestionId = questionId;
        Order = order;
        Text = draft.Text.Trim();
        IsCorrect = draft.IsCorrect;
    }

    public Guid QuestionId { get; private set; }
    public int Order { get; private set; }
    public string Text { get; private set; } = null!;
    public bool IsCorrect { get; private set; }
}
