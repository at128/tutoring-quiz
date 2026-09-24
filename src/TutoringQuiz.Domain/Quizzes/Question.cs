using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Domain.Quizzes;

public sealed class Question : Entity
{
    // Every option ever saved for this question, including ones removed after students answered (kept for history).
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

    /// <summary>
    /// Set when a teacher removed the question from a quiz that students have taken. The row stays so their answers
    /// remain readable; a removed question is never shown or scored.
    /// </summary>
    public DateTime? RemovedAtUtc { get; private set; }

    public bool IsRemoved => RemovedAtUtc is not null;

    /// <summary>The current options, in the teacher's order.</summary>
    public IReadOnlyList<Option> Options => _options.Where(o => !o.IsRemoved).OrderBy(o => o.Order).ToList();

    public Guid CorrectOptionId => Options.Single(o => o.IsCorrect).Id;

    /// <summary>Any option this question ever had, removed ones included (to show what a student once chose).</summary>
    public Option? FindOption(Guid optionId) => _options.FirstOrDefault(o => o.Id == optionId);

    /// <summary>
    /// Applies the teacher's edit while keeping identities: an option whose id is sent again is updated in place,
    /// one without a known id is new, and a current option that isn't sent is removed. Removal is only a mark when
    /// students may have chosen it (<paramref name="keepHistory"/>); otherwise the row is deleted.
    /// </summary>
    internal void Revise(int order, QuestionDraft draft, bool keepHistory, DateTime nowUtc)
    {
        Order = order;
        Text = draft.Text.Trim();
        Points = draft.Points;

        var current = Options;
        var kept = draft.Options.Where(o => o.Id is not null).Select(o => o.Id!.Value).ToHashSet();
        foreach (var option in current.Where(o => !kept.Contains(o.Id)))
        {
            if (keepHistory) option.MarkRemoved(nowUtc);
            else _options.Remove(option);
        }

        var matched = new HashSet<Guid>();
        for (var i = 0; i < draft.Options.Count; i++)
        {
            var optionDraft = draft.Options[i];
            var existing = optionDraft.Id is { } id && matched.Add(id) ? current.FirstOrDefault(o => o.Id == id) : null;
            if (existing is not null) existing.Revise(i + 1, optionDraft);
            else _options.Add(new Option(Id, i + 1, optionDraft));
        }
    }

    internal void MarkRemoved(DateTime nowUtc) => RemovedAtUtc = nowUtc;
}
