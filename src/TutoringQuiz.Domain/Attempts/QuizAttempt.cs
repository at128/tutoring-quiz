using TutoringQuiz.Domain.Common;
using TutoringQuiz.Domain.Quizzes;
using TutoringQuiz.Domain.Scoring;

namespace TutoringQuiz.Domain.Attempts;

/// <summary>
/// A student's single attempt at a quiz. Submitted and Expired are final: score, counts and
/// FinalizedAtUtc are set once and never change.
/// </summary>
public sealed class QuizAttempt : Entity
{
    private readonly List<AttemptAnswer> _answers = [];

    private QuizAttempt() { }

    public Guid QuizId { get; private set; }
    public Guid StudentId { get; private set; }
    public DateTime StartedAtUtc { get; private set; }
    public DateTime DeadlineUtc { get; private set; }
    public AttemptStatus Status { get; private set; }
    public DateTime? FinalizedAtUtc { get; private set; }
    public decimal? Score { get; private set; }
    public int MaxScore { get; private set; }
    public int? CorrectCount { get; private set; }
    public int? WrongCount { get; private set; }
    public int? UnansweredCount { get; private set; }

    /// <summary>Concurrency token, bumped by every answer save and by finalization.</summary>
    public int Version { get; private set; }

    public IReadOnlyList<AttemptAnswer> Answers => _answers;

    public bool IsFinalized => Status != AttemptStatus.InProgress;

    public decimal? Percentage => Score is { } score ? QuizScoring.Percentage(score, MaxScore) : null;

    public static QuizAttempt Start(Quiz quiz, Guid studentId, DateTime nowUtc)
    {
        if (!quiz.IsPublished)
            throw new InvalidOperationException("Only published quizzes can be started.");
        if (nowUtc < quiz.OpensAtUtc)
            throw new DomainException(ErrorCodes.QuizNotOpenYet, $"This quiz opens at {UtcFormat.Iso(quiz.OpensAtUtc)}.");
        if (nowUtc >= quiz.ClosesAtUtc)
            throw new DomainException(ErrorCodes.QuizClosed, $"This quiz closed at {UtcFormat.Iso(quiz.ClosesAtUtc)}.");

        return new QuizAttempt
        {
            QuizId = quiz.Id,
            StudentId = studentId,
            StartedAtUtc = nowUtc,
            DeadlineUtc = AttemptTiming.Deadline(nowUtc, quiz.DurationMinutes, quiz.ClosesAtUtc),
            Status = AttemptStatus.InProgress,
            MaxScore = quiz.MaxScore,
        };
    }

    /// <summary>Upserts the answer for a question (last write wins). Null clears it.</summary>
    public AttemptAnswer SaveAnswer(Question question, Guid? selectedOptionId, DateTime nowUtc)
    {
        if (IsFinalized)
            throw new DomainException(ErrorCodes.AttemptNotInProgress, "This attempt is already finished.");
        if (!AttemptTiming.CanSaveAnswer(nowUtc, DeadlineUtc))
            throw new DomainException(ErrorCodes.AttemptDeadlinePassed, "Time is up. This answer was not saved.");
        if (question.QuizId != QuizId)
            throw new DomainException(ErrorCodes.AnswerInvalidOption, "This question is not part of the quiz.");
        if (selectedOptionId is { } optionId && question.Options.All(o => o.Id != optionId))
            throw new DomainException(ErrorCodes.AnswerInvalidOption, "This option does not belong to the question.");

        var answer = _answers.FirstOrDefault(a => a.QuestionId == question.Id);
        if (answer is null)
        {
            answer = new AttemptAnswer(Id, question.Id, selectedOptionId, nowUtc);
            _answers.Add(answer);
        }
        else
        {
            answer.Change(selectedOptionId, nowUtc);
        }

        Version++;
        return answer;
    }

    /// <summary>
    /// Idempotent. At or before the deadline the attempt becomes Submitted at <paramref name="nowUtc"/>; later it
    /// becomes Expired at the deadline, keeping only what was already saved. Returns false when already final.
    /// </summary>
    public bool Submit(Quiz quiz, DateTime nowUtc)
    {
        if (IsFinalized) return false;

        if (AttemptTiming.IsPastDeadline(nowUtc, DeadlineUtc))
            Finalize(quiz, AttemptStatus.Expired, DeadlineUtc);
        else
            Finalize(quiz, AttemptStatus.Submitted, nowUtc);
        return true;
    }

    /// <summary>Lazy finalization: an in-progress attempt past its deadline becomes Expired at the deadline.</summary>
    public bool FinalizeIfExpired(Quiz quiz, DateTime nowUtc)
    {
        if (IsFinalized || !AttemptTiming.IsPastDeadline(nowUtc, DeadlineUtc)) return false;

        Finalize(quiz, AttemptStatus.Expired, DeadlineUtc);
        return true;
    }

    private void Finalize(Quiz quiz, AttemptStatus status, DateTime finalizedAtUtc)
    {
        if (quiz.Id != QuizId)
            throw new InvalidOperationException("The attempt belongs to a different quiz.");

        // Answers are only ever saved at or before the deadline; the filter keeps that guarantee in scoring too.
        var counted = _answers.Where(a => a.AnsweredAtUtc <= DeadlineUtc);
        var breakdown = QuizScoring.Calculate(quiz.Questions, counted, quiz.WrongAnswerPenaltyPercent);

        Status = status;
        FinalizedAtUtc = finalizedAtUtc;
        Score = breakdown.Score;
        MaxScore = breakdown.MaxScore;
        CorrectCount = breakdown.CorrectCount;
        WrongCount = breakdown.WrongCount;
        UnansweredCount = breakdown.UnansweredCount;
        Version++;
    }
}
