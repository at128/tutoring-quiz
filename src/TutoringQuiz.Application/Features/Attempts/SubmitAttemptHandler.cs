using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Persistence;

namespace TutoringQuiz.Application.Features.Attempts;

/// <summary>Idempotent submit; a late request scores only answers already persisted before the deadline.</summary>
public sealed class SubmitAttemptHandler(IAppDbContext db, StudentAttemptAccess access, TimeProvider clock)
{
    public Task<AttemptResult> HandleAsync(Guid attemptId, CancellationToken ct) =>
        db.RunWithRetryOnConflictAsync(token =>
            db.InWriteTransactionAsync(async inner =>
            {
                var (attempt, quiz) = await access.OwnedAttemptAsync(attemptId, inner);
                if (attempt.Submit(quiz, clock.GetUtcNow().UtcDateTime))
                    await db.SaveChangesAsync(inner);
                return AttemptViews.ToResult(attempt, quiz);
            }, token), ct);
}
