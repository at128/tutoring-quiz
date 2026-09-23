using Microsoft.EntityFrameworkCore;
using TutoringQuiz.Application.Common.Abstractions;

namespace TutoringQuiz.Application.Common.Persistence;

public static class ConcurrencyRetry
{
    /// <summary>
    /// Runs a use case; if another request changed the same attempt first (its <c>Version</c> token moved),
    /// drops everything tracked and runs it once more on fresh data, so the rules are re-checked against the winner
    /// (e.g. an answer racing a submit ends as <c>attempt.not_in_progress</c> instead of a lost write).
    /// </summary>
    public static async Task<T> RunWithRetryOnConflictAsync<T>(
        this IAppDbContext db, Func<CancellationToken, Task<T>> useCase, CancellationToken ct)
    {
        try
        {
            return await useCase(ct);
        }
        catch (DbUpdateConcurrencyException)
        {
            db.ChangeTracker.Clear();
            return await useCase(ct);
        }
    }
}
