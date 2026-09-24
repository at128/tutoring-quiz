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

    /// <summary>
    /// Set when a teacher removed the option from a quiz that students have taken. The row stays so their choices
    /// remain readable; a removed option is never shown to students, correct, or counted.
    /// </summary>
    public DateTime? RemovedAtUtc { get; private set; }

    public bool IsRemoved => RemovedAtUtc is not null;

    /// <summary>Same option (same identity), new wording, position or correctness.</summary>
    internal void Revise(int order, OptionDraft draft)
    {
        Order = order;
        Text = draft.Text.Trim();
        IsCorrect = draft.IsCorrect;
    }

    internal void MarkRemoved(DateTime nowUtc)
    {
        RemovedAtUtc = nowUtc;
        IsCorrect = false;
    }
}
