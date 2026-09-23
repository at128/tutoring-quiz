using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Application.Features.Attempts;

/// <summary>
/// Lazy finalization (no background job): any request that touches attempts first turns the ones past their
/// deadline into Expired, scored from the answers saved before the deadline. Idempotent.
/// </summary>
public sealed class AttemptFinalizer(IAppDbContext db)
{
    /// <returns>How many attempts were finalized (and saved) by this call.</returns>
    public async Task<int> FinalizeExpiredAsync(
        IEnumerable<QuizAttempt> attempts, Func<Guid, Quiz> quizById, DateTime nowUtc, CancellationToken ct)
    {
        var finalized = 0;
        foreach (var attempt in attempts)
        {
            if (attempt.FinalizeIfExpired(quizById(attempt.QuizId), nowUtc)) finalized++;
        }

        if (finalized > 0) await db.SaveChangesAsync(ct);
        return finalized;
    }

    public Task<int> FinalizeIfExpiredAsync(QuizAttempt attempt, Quiz quiz, DateTime nowUtc, CancellationToken ct) =>
        FinalizeExpiredAsync([attempt], _ => quiz, nowUtc, ct);
}
