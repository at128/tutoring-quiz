using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Errors;
using TutoringQuiz.Application.Common.Persistence;
using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Application.Features.Attempts;

public sealed class GetAttemptResultHandler(
    IAppDbContext db, StudentAttemptAccess access, AttemptFinalizer finalizer, TimeProvider clock)
{
    public Task<AttemptResult> HandleAsync(Guid attemptId, CancellationToken ct) =>
        db.RunWithRetryOnConflictAsync(async token =>
        {
            var (attempt, quiz) = await access.OwnedAttemptAsync(attemptId, token);
            await finalizer.FinalizeIfExpiredAsync(attempt, quiz, clock.GetUtcNow().UtcDateTime, token);
            if (!attempt.IsFinalized)
                throw new ConflictException(ErrorCodes.AttemptNotFinalized, "This attempt is still in progress.");
            return AttemptViews.ToResult(attempt, quiz);
        }, ct);
}
