using TutoringQuiz.Api.ErrorHandling;
using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Api.Auth;

/// <summary>
/// CSRF guard: an API request that changes something (any method but GET/HEAD/OPTIONS/TRACE) must come from this
/// site's own pages. <c>SameSite=Strict</c> alone still trusts sibling subdomains, and the bodyless actions
/// (publish, start, submit…) would accept a plain HTML form.
/// Browsers label every request with <c>Sec-Fetch-Site</c> (older ones send <c>Origin</c> on POST). A request with
/// neither comes from outside a browser (curl, tests), so it carries no victim's cookie and passes.
/// </summary>
public static class SameOriginGuard
{
    public const string FetchSiteHeader = "Sec-Fetch-Site";

    public static IApplicationBuilder UseSameOriginApi(this IApplicationBuilder app) =>
        app.Use(async (context, next) =>
        {
            var request = context.Request;
            if (request.Path.StartsWithSegments("/api") &&
                IsForeign(request.Method, request.Headers[FetchSiteHeader], request.Headers.Origin, request.Scheme, request.Host))
            {
                await ApiProblems.WriteAsync(context, ApiProblems.Create(
                    ErrorCodes.Forbidden, "This request came from another website, so it was blocked."));
                return;
            }

            await next(context);
        });

    /// <summary>True when an unsafe request was sent by a page from another origin (after forwarded headers).</summary>
    public static bool IsForeign(string method, string? fetchSite, string? origin, string scheme, HostString host)
    {
        if (HttpMethods.IsGet(method) || HttpMethods.IsHead(method) ||
            HttpMethods.IsOptions(method) || HttpMethods.IsTrace(method))
            return false;
        if (!string.IsNullOrEmpty(fetchSite))
            return !string.Equals(fetchSite, "same-origin", StringComparison.OrdinalIgnoreCase);
        if (string.IsNullOrEmpty(origin))
            return false;

        // "null" (sandboxed frames, privacy redirects) and anything unparsable count as foreign.
        return !Uri.TryCreate(origin, UriKind.Absolute, out var from) || !IsSameOrigin(from, scheme, host);
    }

    private static bool IsSameOrigin(Uri from, string scheme, HostString host) =>
        string.Equals(from.Scheme, scheme, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(from.Host, host.Host, StringComparison.OrdinalIgnoreCase) &&
        from.Port == (host.Port ?? DefaultPort(scheme));

    private static int DefaultPort(string scheme) =>
        string.Equals(scheme, "https", StringComparison.OrdinalIgnoreCase) ? 443 : 80;
}
