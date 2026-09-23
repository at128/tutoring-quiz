using System.Security.Claims;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Errors;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Api.Auth;

/// <summary><see cref="ICurrentUser"/> read from the auth cookie's claims.</summary>
public sealed class CurrentUser(IHttpContextAccessor httpContextAccessor) : ICurrentUser
{
    private ClaimsPrincipal Principal =>
        httpContextAccessor.HttpContext?.User is { Identity.IsAuthenticated: true } principal
            ? principal
            : throw UnauthenticatedException.NotSignedIn();

    public Guid UserId =>
        Guid.TryParse(Principal.FindFirstValue(ClaimTypes.NameIdentifier), out var id)
            ? id
            : throw UnauthenticatedException.NotSignedIn();

    public UserRole Role =>
        Enum.TryParse<UserRole>(Principal.FindFirstValue(ClaimTypes.Role), out var role)
            ? role
            : throw UnauthenticatedException.NotSignedIn();

    public Guid? ClassRoomId =>
        Guid.TryParse(Principal.FindFirstValue(AppClaimTypes.ClassRoomId), out var id) ? id : null;
}
