using TutoringQuiz.Domain.Common;
using TutoringQuiz.Domain.Scoring;

namespace TutoringQuiz.Domain.Quizzes;

/// <summary>Aggregate root for a quiz, its questions/options and the classes it is assigned to.</summary>
public sealed class Quiz : Entity
{
    // Every question ever saved, including ones removed after students answered them (kept for history).
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
    /// <summary>Set when a wrong answer costs a fixed number of points (capped at the question's points).</summary>
    public decimal? WrongAnswerPenaltyPoints { get; private set; }
    public WrongAnswerPenalty WrongAnswerPenalty => new(WrongAnswerPenaltyPercent, WrongAnswerPenaltyPoints);
    public bool IsPublished { get; private set; }
    /// <summary>Whether students see their score. Read live on every student request; never copied into results.</summary>
    public bool ScoresVisibleToStudents { get; private set; } = true;
    public DateTime CreatedAtUtc { get; private set; }
    public DateTime UpdatedAtUtc { get; private set; }

    /// <summary>The current questions, in the teacher's order.</summary>
    public IReadOnlyList<Question> Questions => _questions.Where(q => !q.IsRemoved).OrderBy(q => q.Order).ToList();
    public IReadOnlyList<QuizClassRoom> ClassRooms => _classRooms;

    public int MaxScore => Questions.Sum(q => q.Points);

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
        quiz.Apply(details, classRoomIds, questions, keepHistory: false, nowUtc);
        return quiz;
    }

    /// <summary>
    /// Replaces settings, classes and questions; questions and options sent with their id keep their identity.
    /// Once students have an attempt, nothing can change while the quiz is still open (by server time). After it
    /// closes the teacher may correct its content and marking, and the caller must regrade every attempt in the same
    /// transaction; the dates, time limit and classes the students took it under stay as they were.
    /// </summary>
    public void Update(
        QuizDetails details,
        IReadOnlyCollection<Guid> classRoomIds,
        IReadOnlyList<QuestionDraft> questions,
        bool hasAttempts,
        DateTime nowUtc)
    {
        if (hasAttempts) EnsureEditableAfterAttempts(details, classRoomIds, nowUtc);
        QuizRules.EnsureValid(details, classRoomIds, questions);
        if (IsPublished && questions.Count == 0)
            throw new DomainException(ErrorCodes.QuizInvalidForPublish,
                "A published quiz must keep at least one question.",
                new Dictionary<string, string[]> { ["questions"] = ["Add at least one question."] });
        Apply(details, classRoomIds, questions, keepHistory: hasAttempts, nowUtc);
        UpdatedAtUtc = nowUtc;
    }

    /// <summary>
    /// True when students have attempts and the quiz hasn't closed yet: its content is frozen. A student may still save
    /// at the closing instant itself (deadlines are inclusive), so editing opens only after it.
    /// </summary>
    public bool IsLockedAt(DateTime nowUtc, bool hasAttempts) => hasAttempts && nowUtc <= ClosesAtUtc;

    /// <summary>Allowed in every state: it changes what students see, never a score.</summary>
    public void SetScoresVisibleToStudents(bool visible, DateTime nowUtc)
    {
        if (ScoresVisibleToStudents == visible) return;
        ScoresVisibleToStudents = visible;
        UpdatedAtUtc = nowUtc;
    }

    private void EnsureEditableAfterAttempts(QuizDetails details, IReadOnlyCollection<Guid> classRoomIds, DateTime nowUtc)
    {
        if (IsLockedAt(nowUtc, hasAttempts: true))
            throw new DomainException(ErrorCodes.QuizLocked,
                "Students have already started this quiz, so its content can't change until it closes.");

        static bool Same(DateTime a, DateTime b) => Math.Abs((a - b).Ticks) < TimeSpan.TicksPerMillisecond;
        var sameSchedule = Same(details.OpensAtUtc, OpensAtUtc) && Same(details.ClosesAtUtc, ClosesAtUtc) &&
            details.DurationMinutes == DurationMinutes &&
            classRoomIds.ToHashSet().SetEquals(_classRooms.Select(c => c.ClassRoomId));
        if (!sameSchedule)
            throw new DomainException(ErrorCodes.QuizLocked,
                "Students have taken this quiz, so its dates, time limit and classes can't change. Its questions, answers, points and marking still can.");
    }

    public void Publish(DateTime nowUtc)
    {
        if (IsPublished) return;

        EnsurePublishable(Questions.Count, ClosesAtUtc, nowUtc);

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

    private static void EnsurePublishable(int questionCount, DateTime closesAtUtc, DateTime nowUtc)
    {
        var errors = new Dictionary<string, string[]>();
        if (questionCount == 0)
            errors["questions"] = ["Add at least one question before publishing."];
        if (closesAtUtc <= nowUtc)
            errors["closesAt"] = ["The closing time must be in the future."];
        if (errors.Count > 0)
            throw new DomainException(ErrorCodes.QuizInvalidForPublish, "This quiz can't be published yet.", errors);
    }

    private void Apply(QuizDetails details, IReadOnlyCollection<Guid> classRoomIds, IReadOnlyList<QuestionDraft> questions,
        bool keepHistory, DateTime nowUtc)
    {
        Title = details.Title.Trim();
        Description = string.IsNullOrWhiteSpace(details.Description) ? null : details.Description.Trim();
        OpensAtUtc = details.OpensAtUtc;
        ClosesAtUtc = details.ClosesAtUtc;
        DurationMinutes = details.DurationMinutes;
        WrongAnswerPenaltyPercent = details.WrongAnswerPenaltyPercent;
        WrongAnswerPenaltyPoints = details.WrongAnswerPenaltyPoints;
        ScoresVisibleToStudents = details.ScoresVisibleToStudents;

        // Diff the classes instead of clearing: re-adding the same (QuizId, ClassRoomId) key would clash in EF.
        var wanted = classRoomIds.ToHashSet();
        _classRooms.RemoveAll(c => !wanted.Contains(c.ClassRoomId));
        foreach (var id in wanted.Where(id => _classRooms.All(c => c.ClassRoomId != id)))
            _classRooms.Add(new QuizClassRoom(Id, id));

        ReviseQuestions(questions, keepHistory, nowUtc);
    }

    /// <summary>
    /// A question whose id is sent again is updated in place (with its options), one without a known id is new, and
    /// a current question that isn't sent is removed: only marked when students may have answered it
    /// (<paramref name="keepHistory"/>), deleted otherwise.
    /// </summary>
    private void ReviseQuestions(IReadOnlyList<QuestionDraft> drafts, bool keepHistory, DateTime nowUtc)
    {
        var current = Questions;
        var kept = drafts.Where(d => d.Id is not null).Select(d => d.Id!.Value).ToHashSet();
        foreach (var question in current.Where(q => !kept.Contains(q.Id)))
        {
            if (keepHistory) question.MarkRemoved(nowUtc);
            else _questions.Remove(question);
        }

        var matched = new HashSet<Guid>();
        for (var i = 0; i < drafts.Count; i++)
        {
            var draft = drafts[i];
            var existing = draft.Id is { } id && matched.Add(id) ? current.FirstOrDefault(q => q.Id == id) : null;
            if (existing is not null) existing.Revise(i + 1, draft, keepHistory, nowUtc);
            else _questions.Add(new Question(Id, i + 1, draft));
        }
    }
}
