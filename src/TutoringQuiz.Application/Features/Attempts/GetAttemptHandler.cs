using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Persistence;

namespace TutoringQuiz.Application.Features.Attempts;

public sealed class GetAttemptHandler(
    IAppDbContext db, StudentAttemptAccess access, AttemptFinalizer finalizer, TimeProvider clock)
{
    public Task<AttemptView> HandleAsync(Guid attemptId, CancellationToken ct) =>
        db.RunWithRetryOnConflictAsync(async token =>
        {
            var (attempt, quiz) = await access.OwnedAttemptAsync(attemptId, token);
            var now = clock.GetUtcNow().UtcDateTime;
            await finalizer.FinalizeIfExpiredAsync(attempt, quiz, now, token);
            return AttemptViews.ToView(attempt, quiz, now);
        }, ct);
}
