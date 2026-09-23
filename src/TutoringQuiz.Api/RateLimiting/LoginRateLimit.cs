using System.Globalization;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using TutoringQuiz.Api.ErrorHandling;
using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Api.RateLimiting;

/// <summary>Fixed window per client IP on <c>POST /api/auth/login</c> (default 10 per minute) → 429 ProblemDetails.</summary>
public static class LoginRateLimit
{
    public const string PolicyName = "login";
    private const int DefaultPermitsPerMinute = 10;

    public static IServiceCollection AddLoginRateLimit(this IServiceCollection services, IConfiguration configuration)
    {
        var permitLimit = int.TryParse(configuration["RateLimiting:LoginPermitsPerMinute"], out var configured) && configured > 0
            ? configured
            : DefaultPermitsPerMinute;

        return services.AddRateLimiter(options =>
        {
            options.AddPolicy(PolicyName, httpContext => RateLimitPartition.GetFixedWindowLimiter(
                httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
                _ => new FixedWindowRateLimiterOptions
                {
                    PermitLimit = permitLimit,
                    Window = TimeSpan.FromMinutes(1),
                    QueueLimit = 0,
                }));

            options.OnRejected = async (context, _) =>
            {
                if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
                    context.HttpContext.Response.Headers.RetryAfter =
                        ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString(CultureInfo.InvariantCulture);

                await ApiProblems.WriteAsync(context.HttpContext, ApiProblems.Create(
                    ErrorCodes.RateLimited, "Too many sign-in attempts. Wait a minute, then try again."));
            };
        });
    }
}
