using System.Security.Claims;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;
using TutoringQuiz.Api.ErrorHandling;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Api.Auth;

public static class AuthSetup
{
    public const string CookieName = "tq.auth";

    /// <summary>
    /// HttpOnly cookie auth (same origin as the SPA, so no tokens in JS). API calls never redirect: no session → 401,
    /// wrong role → 403, both as ProblemDetails.
    /// </summary>
    public static IServiceCollection AddCookieAuth(this IServiceCollection services, IConfiguration configuration)
    {
        services
            .AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
            .AddCookie(options =>
            {
                options.Cookie.Name = CookieName;
                options.Cookie.HttpOnly = true;
                options.Cookie.SameSite = SameSiteMode.Strict;
                // Follows the request scheme so http://<LAN-IP>:8080 works on a real phone; HTTPS in production.
                options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
                options.Cookie.IsEssential = true;
                options.SlidingExpiration = true;
                options.ExpireTimeSpan = TimeSpan.FromHours(8);
                options.Events.OnValidatePrincipal = async context =>
                {
                    var principal = context.Principal;
                    var idClaim = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
                    var roleClaim = principal?.FindFirstValue(ClaimTypes.Role);
                    var classClaim = principal?.FindFirstValue(AppClaimTypes.ClassRoomId);

                    if (!Guid.TryParse(idClaim, out var userId) ||
                        !Guid.TryParse(classClaim, out var claimedClassId) && classClaim is not null)
                    {
                        context.RejectPrincipal();
                        return;
                    }

                    // A protected cookie can outlive its user or their authorization scope.
                    // Recheck the authoritative role/class before any endpoint trusts those claims.
                    var db = context.HttpContext.RequestServices.GetRequiredService<IAppDbContext>();
                    var user = await db.Users.AsNoTracking()
                        .Where(candidate => candidate.Id == userId)
                        .Select(candidate => new { candidate.Role, candidate.ClassRoomId })
                        .SingleOrDefaultAsync(context.HttpContext.RequestAborted);

                    if (user is null || !string.Equals(roleClaim, user.Role.ToString(), StringComparison.Ordinal) ||
                        user.ClassRoomId != (classClaim is null ? null : claimedClassId))
                        context.RejectPrincipal();
                };
                options.Events.OnRedirectToLogin = context => ApiProblems.WriteAsync(
                    context.HttpContext, ApiProblems.Create(ErrorCodes.Unauthenticated, "Sign in to continue."));
                options.Events.OnRedirectToAccessDenied = context => ApiProblems.WriteAsync(
                    context.HttpContext, ApiProblems.Create(ErrorCodes.Forbidden, "Your account can't use this part of the site."));
            });

        // Keep cookie keys on the data volume so a container restart doesn't sign everyone out mid-quiz.
        if (configuration["DataProtection:KeysPath"] is { Length: > 0 } keysPath)
            services.AddDataProtection().PersistKeysToFileSystem(new DirectoryInfo(keysPath));

        services.AddAuthorization();
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentUser, CurrentUser>();
        return services;
    }
}
