namespace TutoringQuiz.Api.Auth;

/// <summary>Custom claims in the auth cookie (id, username and role use the standard <c>ClaimTypes</c>).</summary>
public static class AppClaimTypes
{
    public const string FullName = "full_name";
    public const string ClassRoomId = "classroom_id";
}
