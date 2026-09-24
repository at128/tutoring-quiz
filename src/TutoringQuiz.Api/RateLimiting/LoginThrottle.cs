using System.Net;
using System.Threading.RateLimiting;

namespace TutoringQuiz.Api.RateLimiting;

/// <summary>
/// Sign-in attempts per client IP + username (fixed one-minute window). Keyed on both so that guessing one account's
/// password is slowed down, while a class of students signing in together from one Wi-Fi (same IP, different usernames)
/// is not, and nobody elsewhere can lock a student out by hammering their username.
/// </summary>
public sealed class LoginThrottle(int permitsPerMinute) : IDisposable
{
    // Beyond the longest valid username the key adds nothing; the cap bounds memory per junk request.
    private const int MaxKeyUsernameLength = 64;

    private readonly PartitionedRateLimiter<string> _limiter = PartitionedRateLimiter.Create<string, string>(
        key => RateLimitPartition.GetFixedWindowLimiter(key, _ => LoginRateLimit.OneMinuteWindow(permitsPerMinute)));

    /// <summary>Counts one attempt. False when the limit is reached; <paramref name="retryAfter"/> then says how long to wait.</summary>
    public bool TryEnter(IPAddress? client, string? username, out TimeSpan? retryAfter)
    {
        using var lease = _limiter.AttemptAcquire(KeyOf(client, username));
        retryAfter = !lease.IsAcquired && lease.TryGetMetadata(MetadataName.RetryAfter, out var wait) ? wait : null;
        return lease.IsAcquired;
    }

    /// <summary>Same normalization as sign-in (trimmed, upper-invariant), so "10A-01 " and "10a-01" share a limit.</summary>
    internal static string KeyOf(IPAddress? client, string? username)
    {
        var name = (username ?? string.Empty).Trim().ToUpperInvariant();
        if (name.Length > MaxKeyUsernameLength) name = name[..MaxKeyUsernameLength];
        return $"{client?.ToString() ?? "unknown"}|{name}";
    }

    public void Dispose() => _limiter.Dispose();
}
