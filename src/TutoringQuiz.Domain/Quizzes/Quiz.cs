using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Domain.Quizzes;

/// <summary>Aggregate root for a quiz, its questions/options and the classes it is assigned to.</summary>
public sealed class Quiz : Entity
{
    private readonly List<Question> _questions = [];
    private readonly List<QuizClassRoom> _classRooms = [];

    private Quiz() { }

    public Guid TeacherId { get; private set; }
    public string Title { get; private set; } = null!;
    public string? Description { get; private set; }
    public DateTime OpensAtUtc { get; private set; }
    public DateTime ClosesAtUtc { get; private set; }
    public int DurationMinutes { get; private set; }
    public int WrongAnswerPenaltyPercent { get; private set; }
    public bool IsPublished { get; private set; }
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    public IReadOnlyList<Question> Questions => _questions;
    public IReadOnlyList<QuizClassRoom> ClassRooms => _classRooms;

    public int MaxScore => _questions.Sum(q => q.Points);

    /// <summary>Creates an unpublished draft. A draft may have no questions yet.</summary>
    public static Quiz Create(
        Guid teacherId,
        QuizDetails details,
        IReadOnlyCollection<Guid> classRoomIds,
        IReadOnlyList<QuestionDraft> questions,
        DateTime nowUtc)
    {
        QuizRules.EnsureValid(details, classRoomIds, questions);
        var quiz = new Quiz { TeacherId = teacherId, CreatedAtUtc = nowUtc, UpdatedAtUtc = nowUtc };
        quiz.Apply(details, classRoomIds, questions);
        return quiz;
    }

    /// <summary>Full replace of settings, classes and questions. Frozen once any student has an attempt.</summary>
    public void Update(
        QuizDetails details,
        IReadOnlyCollection<Guid> classRoomIds,
        IReadOnlyList<QuestionDraft> questions,
        bool hasAttempts,
        DateTime nowUtc)
    {
        if (hasAttempts)
            throw new DomainException(ErrorCodes.QuizLocked,
                "Students have already started this quiz, so its content can no longer change.");
        QuizRules.EnsureValid(details, classRoomIds, questions);
        Apply(details, classRoomIds, questions);
        UpdatedAtUtc = nowUtc;
    }

    public void Publish(DateTime nowUtc)
    {
        if (IsPublished) return;

        var errors = new Dictionary<string, string[]>();
        if (_questions.Count == 0)
            errors["questions"] = ["Add at least one question before publishing."];
        if (ClosesAtUtc <= nowUtc)
            errors["closesAt"] = ["The closing time must be in the future."];
        if (errors.Count > 0)
            throw new DomainException(ErrorCodes.QuizInvalidForPublish, "This quiz can't be published yet.", errors);

        IsPublished = true;
        UpdatedAtUtc = nowUtc;
    }

    public void Unpublish(bool hasAttempts, DateTime nowUtc)
    {
        if (hasAttempts)
            throw new DomainException(ErrorCodes.QuizHasAttempts,
                "Students have already started this quiz, so it can't be unpublished.");
        IsPublished = false;
        UpdatedAtUtc = nowUtc;
    }

    public void EnsureCanBeDeleted(bool hasAttempts)
    {
        if (hasAttempts)
            throw new DomainException(ErrorCodes.QuizHasAttempts,
                "Students have already started this quiz, so it can't be deleted.");
    }

    /// <summary>Open is inclusive, close is exclusive.</summary>
    public bool IsOpenAt(DateTime nowUtc) => IsPublished && OpensAtUtc <= nowUtc && nowUtc < ClosesAtUtc;

    public TeacherQuizState StateAt(DateTime nowUtc) =>
        !IsPublished ? TeacherQuizState.Draft
        : nowUtc < OpensAtUtc ? TeacherQuizState.Scheduled
        : nowUtc < ClosesAtUtc ? TeacherQuizState.Open
        : TeacherQuizState.Closed;

    public bool IsAssignedTo(Guid classRoomId) => _classRooms.Any(c => c.ClassRoomId == classRoomId);

    private void Apply(QuizDetails details, IReadOnlyCollection<Guid> classRoomIds, IReadOnlyList<QuestionDraft> questions)
    {
        Title = details.Title.Trim();
        Description = string.IsNullOrWhiteSpace(details.Description) ? null : details.Description.Trim();
        OpensAtUtc = details.OpensAtUtc;
        ClosesAtUtc = details.ClosesAtUtc;
        DurationMinutes = details.DurationMinutes;
        WrongAnswerPenaltyPercent = details.WrongAnswerPenaltyPercent;

        // Diff the classes instead of clearing: re-adding the same (QuizId, ClassRoomId) key would clash in EF.
        var wanted = classRoomIds.ToHashSet();
        _classRooms.RemoveAll(c => !wanted.Contains(c.ClassRoomId));
        foreach (var id in wanted.Where(id => _classRooms.All(c => c.ClassRoomId != id)))
            _classRooms.Add(new QuizClassRoom(Id, id));

        _questions.Clear();
        for (var i = 0; i < questions.Count; i++)
            _questions.Add(new Question(Id, i + 1, questions[i]));
    }
}
