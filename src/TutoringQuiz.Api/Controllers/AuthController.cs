using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using TutoringQuiz.Api.Auth;
using TutoringQuiz.Api.RateLimiting;
using TutoringQuiz.Application.Features.Auth;

namespace TutoringQuiz.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting(LoginRateLimit.PolicyName)]
    public async Task<ActionResult<CurrentUserView>> Login(
        [FromBody] LoginCommand command, [FromServices] LoginHandler handler, [FromServices] LoginThrottle throttle,
        CancellationToken ct)
    {
        if (!throttle.TryEnter(HttpContext.Connection.RemoteIpAddress, command.Username, out var retryAfter))
        {
            await LoginRateLimit.WriteRejectionAsync(HttpContext, retryAfter);
            return new EmptyResult();
        }

        var user = await handler.HandleAsync(command, ct);
        await HttpContext.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, UserPrincipalFactory.Create(user));
        return Ok(user);
    }

    /// <summary>Idempotent: signing out without a session is fine.</summary>
    [HttpPost("logout")]
    [AllowAnonymous]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return NoContent();
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<CurrentUserView>> Me([FromServices] GetCurrentUserHandler handler, CancellationToken ct) =>
        Ok(await handler.HandleAsync(ct));
}
