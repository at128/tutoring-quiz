using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.ClassRooms;
using TutoringQuiz.Domain.Quizzes;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Application.Common.Abstractions;

/// <summary>
/// Persistence seen by use cases: one set per aggregate root (questions, options and answers are reached through
/// their root). A unique-key clash on save surfaces as <see cref="Errors.DuplicateKeyException"/>.
/// </summary>
public interface IAppDbContext
{
    DbSet<ClassRoom> ClassRooms { get; }
    DbSet<User> Users { get; }
    DbSet<Quiz> Quizzes { get; }
    DbSet<QuizAttempt> QuizAttempts { get; }

    /// <summary>Used to drop stale tracked state before re-running a use case that lost a concurrency race.</summary>
    ChangeTracker ChangeTracker { get; }

    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
