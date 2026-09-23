using Microsoft.EntityFrameworkCore;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Errors;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Application.Features.Auth;

/// <summary>Checks a username (case-insensitive) and password. Signing in (the cookie) is the API's job.</summary>
public sealed class LoginHandler(IAppDbContext db, IPasswordHasher passwordHasher)
{
    public async Task<CurrentUserView> HandleAsync(LoginCommand command, CancellationToken ct)
    {
        var credentials = LoginValidator.Validate(command);
        var user = await FindByUsernameAsync(credentials.Username, ct);
        EnsurePasswordMatches(user, credentials.Password);

        return await db.FindCurrentUserViewAsync(user!.Id, ct)
            ?? throw UnauthenticatedException.InvalidCredentials();
    }

    private Task<User?> FindByUsernameAsync(string username, CancellationToken ct)
    {
        var normalized = User.Normalize(username);
        return db.Users.AsNoTracking().SingleOrDefaultAsync(u => u.UsernameNormalized == normalized, ct);
    }

    private void EnsurePasswordMatches(User? user, string password)
    {
        if (user is null)
        {
            // Spend the same hashing time as a real check so response time doesn't reveal which usernames exist.
            passwordHasher.Hash(password);
            throw UnauthenticatedException.InvalidCredentials();
        }

        if (!passwordHasher.Verify(user.PasswordHash, password))
            throw UnauthenticatedException.InvalidCredentials();
    }
}
