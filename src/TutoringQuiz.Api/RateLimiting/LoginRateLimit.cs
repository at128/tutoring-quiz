using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using TutoringQuiz.Api.ErrorHandling;
using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Api.RateLimiting;

/// <summary>
/// Sign-in limits, both → 429 ProblemDetails with <c>Retry-After</c>:
/// <list type="bullet">
/// <item>per client IP on <c>POST /api/auth/login</c> (middleware, default 100/min): a loose cap against floods; a class
/// signing in together from one Wi-Fi shares an IP and stays well under it;</item>
/// <item>per client IP + username (<see cref="LoginThrottle"/>, default 10/min): stops password guessing on one account.</item>
/// </list>
/// </summary>
public static class LoginRateLimit
{
    public const string PolicyName = "login";
    private const int DefaultPermitsPerMinutePerIp = 100;
    private const int DefaultPermitsPerMinutePerAccount = 10;

    public static IServiceCollection AddLoginRateLimit(this IServiceCollection services, IConfiguration configuration)
    {
        var perIp = PermitsPerMinute(configuration, "LoginPermitsPerMinutePerIp", DefaultPermitsPerMinutePerIp);
        var perAccount = PermitsPerMinute(configuration, "LoginPermitsPerMinute", DefaultPermitsPerMinutePerAccount);

        services.AddSingleton(_ => new LoginThrottle(perAccount)); // container-owned, so its timer is disposed
        return services.AddRateLimiter(options =>
        {
            options.AddPolicy(PolicyName, httpContext => RateLimitPartition.GetFixedWindowLimiter(
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => OneMinuteWindow(perIp)));

            options.OnRejected = (context, _) => new ValueTask(WriteRejectionAsync(
                context.HttpContext,
                context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter) ? retryAfter : null));
        });
    }

    internal static FixedWindowRateLimiterOptions OneMinuteWindow(int permits) =>
        new() { PermitLimit = permits, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 };

    public static async Task WriteRejectionAsync(HttpContext httpContext, TimeSpan? retryAfter)
    {
        if (retryAfter is { } wait)
            httpContext.Response.Headers.RetryAfter =
                ((int)Math.Ceiling(wait.TotalSeconds)).ToString(CultureInfo.InvariantCulture);

        await ApiProblems.WriteAsync(httpContext, ApiProblems.Create(
            ErrorCodes.RateLimited, "Too many sign-in attempts. Wait a minute, then try again."));
    }

    private static int PermitsPerMinute(IConfiguration configuration, string key, int fallback) =>
        int.TryParse(configuration[$"RateLimiting:{key}"], out var configured) && configured > 0 ? configured : fallback;
}
