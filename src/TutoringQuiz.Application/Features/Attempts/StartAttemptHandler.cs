using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Errors;
using TutoringQuiz.Application.Common.Persistence;
using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.Common;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Application.Features.Attempts;

public sealed record StartAttemptOutcome(AttemptView Attempt, bool Created);

/// <summary>Starts once, resumes an active attempt, and resolves two simultaneous starts to the same row.</summary>
public sealed class StartAttemptHandler(
    IAppDbContext db, StudentAttemptAccess access, AttemptFinalizer finalizer, TimeProvider clock)
{
    public async Task<StartAttemptOutcome> HandleAsync(Guid quizId, CancellationToken ct)
    {
        var decision = await db.RunWithRetryOnConflictAsync(
            token => db.InWriteTransactionAsync(inner => ExecuteAsync(quizId, inner), token), ct);
        return decision switch
        {
            StartDecision.Started started => started.Outcome,
            StartDecision.AlreadyTaken => throw new ConflictException(
                ErrorCodes.AttemptAlreadyTaken, "You've already taken this quiz."),
            _ => throw new InvalidOperationException("Unknown attempt-start decision."),
        };
    }

    private abstract record StartDecision
    {
        public sealed record Started(StartAttemptOutcome Outcome) : StartDecision;
        public sealed record AlreadyTaken : StartDecision;
    }

    private async Task<StartDecision> ExecuteAsync(Guid quizId, CancellationToken ct)
    {
        var (studentId, classRoomId) = access.Student;
        var quiz = await access.VisibleQuizAsync(quizId, classRoomId, ct);
        var now = clock.GetUtcNow().UtcDateTime;

        if (await access.ExistingAttemptAsync(quizId, studentId, ct) is { } existing)
            return await ResumeOrRejectAsync(existing, quiz, now, ct);

        var attempt = QuizAttempt.Start(quiz, studentId, now);
        db.QuizAttempts.Add(attempt);
        try
        {
            await db.SaveChangesAsync(ct);
            return new StartDecision.Started(
                new StartAttemptOutcome(AttemptViews.ToView(attempt, quiz, now), Created: true));
        }
        catch (DuplicateKeyException)
        {
            // Another tab won the unique (quiz, student) key. Discard our unsaved row before reloading it.
            db.ChangeTracker.Clear();
            var winner = await access.ExistingAttemptAsync(quizId, studentId, ct);
            if (winner is null) throw;
            return await ResumeOrRejectAsync(winner, quiz, clock.GetUtcNow().UtcDateTime, ct);
        }
    }

    private async Task<StartDecision> ResumeOrRejectAsync(
        QuizAttempt attempt, Quiz quiz, DateTime nowUtc, CancellationToken ct)
    {
        await finalizer.FinalizeIfExpiredAsync(attempt, quiz, nowUtc, ct);
        if (attempt.IsFinalized)
            return new StartDecision.AlreadyTaken();
        return new StartDecision.Started(
            new StartAttemptOutcome(AttemptViews.ToView(attempt, quiz, nowUtc), Created: false));
    }
}
