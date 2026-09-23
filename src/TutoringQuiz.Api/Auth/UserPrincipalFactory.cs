using System.Security.Claims;
using Microsoft.AspNetCore.Authentication.Cookies;
using TutoringQuiz.Application.Features.Auth;

namespace TutoringQuiz.Api.Auth;

public static class UserPrincipalFactory
{
    public static ClaimsPrincipal Create(CurrentUserView user)
    {
        List<Claim> claims =
        [
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Role, user.Role.ToString()),
            new(AppClaimTypes.FullName, user.FullName),
        ];
        if (user.ClassRoom is { } classRoom)
            claims.Add(new Claim(AppClaimTypes.ClassRoomId, classRoom.Id.ToString()));

        return new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
    }
}
