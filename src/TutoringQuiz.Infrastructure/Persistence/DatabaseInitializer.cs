using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using TutoringQuiz.Infrastructure.Seeding;

namespace TutoringQuiz.Infrastructure.Persistence;

/// <summary>Startup: apply migrations, then seed demo data when enabled and the database has no users yet.</summary>
public sealed class DatabaseInitializer(
    AppDbContext db,
    DemoDataSeeder seeder,
    SeedOptions seedOptions,
    ILogger<DatabaseInitializer> logger)
{
    public async Task InitializeAsync(CancellationToken ct)
    {
        await db.Database.MigrateAsync(ct);

        // Write-ahead logging lets a class read while answers are being written.
        await db.Database.ExecuteSqlRawAsync("PRAGMA journal_mode=WAL;", ct);

        if (!seedOptions.Enabled) return;
        if (await db.Users.AnyAsync(ct))
        {
            logger.LogInformation("Skipping demo data: the database already has users");
            return;
        }

        await seeder.SeedAsync(ct);
    }
}
