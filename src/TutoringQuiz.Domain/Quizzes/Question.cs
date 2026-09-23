using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Domain.Quizzes;

public sealed class Question : Entity
{
    private readonly List<Option> _options = [];

    private Question() { }

    internal Question(Guid quizId, int order, QuestionDraft draft)
    {
        QuizId = quizId;
        Order = order;
        Text = draft.Text.Trim();
        Points = draft.Points;
        for (var i = 0; i < draft.Options.Count; i++)
            _options.Add(new Option(Id, i + 1, draft.Options[i]));
    }

    public Guid QuizId { get; private set; }
    public int Order { get; private set; }
    public string Text { get; private set; } = null!;
    public int Points { get; private set; }
    public IReadOnlyList<Option> Options => _options;

    public Guid CorrectOptionId => _options.Single(o => o.IsCorrect).Id;
}
