using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Errors;

namespace TutoringQuiz.Application.Features.Auth;

public sealed class GetCurrentUserHandler(IAppDbContext db, ICurrentUser currentUser)
{
    /// <exception cref="UnauthenticatedException">The cookie points at a user that no longer exists.</exception>
    public async Task<CurrentUserView> HandleAsync(CancellationToken ct) =>
        await db.FindCurrentUserViewAsync(currentUser.UserId, ct)
        ?? throw UnauthenticatedException.NotSignedIn();
}
