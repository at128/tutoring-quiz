using Microsoft.AspNetCore.Identity;
using TutoringQuiz.Application.Common.Abstractions;

namespace TutoringQuiz.Infrastructure.Security;

/// <summary>PBKDF2 hashing from ASP.NET Core Identity (salted, versioned format), without the rest of Identity.</summary>
internal sealed class PasswordHasher : IPasswordHasher
{
    private static readonly PasswordHasher<object> Hasher = new();
    private static readonly object Subject = new();

    public string Hash(string password) => Hasher.HashPassword(Subject, password);

    public bool Verify(string passwordHash, string password)
    {
        try
        {
            return Hasher.VerifyHashedPassword(Subject, passwordHash, password)
                is PasswordVerificationResult.Success or PasswordVerificationResult.SuccessRehashNeeded;
        }
        catch (FormatException)
        {
            return false; // a corrupted hash never matches
        }
    }
}
