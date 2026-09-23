using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Infrastructure.Persistence;
using TutoringQuiz.Infrastructure.Security;
using TutoringQuiz.Infrastructure.Seeding;

namespace TutoringQuiz.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("Default")
            ?? throw new InvalidOperationException("ConnectionStrings:Default is not configured.");

        // Split queries: loading a quiz with questions and options must not multiply rows per option.
        services.AddDbContext<AppDbContext>(options => options.UseSqlite(
            connectionString,
            sqlite => sqlite.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery)));
        services.AddScoped<IAppDbContext>(provider => provider.GetRequiredService<AppDbContext>());
        services.AddSingleton<IPasswordHasher, PasswordHasher>();

        services.AddSingleton(SeedOptions.From(configuration));
        services.AddScoped<DemoDataSeeder>();
        services.AddScoped<DatabaseInitializer>();

        return services;
    }

    /// <summary>Migrates and (optionally) seeds the database; call once at startup.</summary>
    public static async Task InitializeDatabaseAsync(this IServiceProvider services, CancellationToken ct = default)
    {
        await using var scope = services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<DatabaseInitializer>().InitializeAsync(ct);
    }
}
