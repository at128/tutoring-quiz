using Microsoft.Extensions.Logging;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Infrastructure.Persistence;

namespace TutoringQuiz.Infrastructure.Seeding;

/// <summary>Loads <c>seed/</c> (CSV + JSON) into an empty database in one transaction.</summary>
public sealed class DemoDataSeeder(
    AppDbContext db,
    IPasswordHasher passwordHasher,
    SeedOptions options,
    TimeProvider clock,
    ILogger<DemoDataSeeder> logger)
{
    public async Task SeedAsync(CancellationToken ct)
    {
        // Relative quiz times are anchored to a whole minute so the demo shows tidy times.
        var now = clock.GetUtcNow().UtcDateTime;
        now = new DateTime(now.Ticks - now.Ticks % TimeSpan.TicksPerMinute, DateTimeKind.Utc);

        var graph = SeedGraphBuilder.Build(SeedFiles.Read(options.Path), options, passwordHasher, now);

        db.ClassRooms.AddRange(graph.ClassRooms);
        db.Users.AddRange(graph.Teachers);
        db.Users.AddRange(graph.Students);
        db.Quizzes.AddRange(graph.Quizzes);
        db.QuizAttempts.AddRange(graph.Attempts);
        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Seeded {ClassRooms} classes, {Teachers} teachers, {Students} students, {Quizzes} quizzes and {Attempts} demo attempts from {Path}",
            graph.ClassRooms.Count, graph.Teachers.Count, graph.Students.Count, graph.Quizzes.Count, graph.Attempts.Count, options.Path);
    }
}
