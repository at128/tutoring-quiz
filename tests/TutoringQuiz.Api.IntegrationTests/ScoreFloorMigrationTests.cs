using System.Net;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.Extensions.DependencyInjection;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;
using TutoringQuiz.Infrastructure.Persistence;

namespace TutoringQuiz.Api.IntegrationTests;

/// <summary>Results stored before scores stopped at 0 are brought to the new rule by the ScoresNeverBelowZero migration.</summary>
public sealed class ScoreFloorMigrationTests(TestAppFactory factory) : IClassFixture<TestAppFactory>
{
    [Fact]
    public async Task AScoreStoredBelowZero_IsRaisedToZero_AndOtherScoresStay()
    {
        var data = await TestData.CreateAsync(factory);
        using var first = await TestData.LoginAsync(factory, data.Student);
        using var second = await TestData.LoginAsync(factory, data.SecondStudent);
        var negative = await StartAndSubmitAsync(first, data.Quiz.Id);
        var positive = await StartAndSubmitAsync(second, data.Quiz.Id);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        // As the old rule stored them.
        await db.Database.ExecuteSqlAsync($"""UPDATE "QuizAttempts" SET "Score" = {"-4.5"} WHERE "Id" = {negative}""");
        await db.Database.ExecuteSqlAsync($"""UPDATE "QuizAttempts" SET "Score" = {"3.25"} WHERE "Id" = {positive}""");

        var migrator = db.GetService<IMigrator>();
        await migrator.MigrateAsync("InitialCreate"); // back to before the data fix (its Down changes nothing)
        await migrator.MigrateAsync();

        var scores = await db.QuizAttempts.AsNoTracking()
            .Where(a => a.Id == negative || a.Id == positive)
            .ToDictionaryAsync(a => a.Id, a => a.Score);
        Assert.Equal(0m, scores[negative]);
        Assert.Equal(3.25m, scores[positive]);
    }

    private static async Task<Guid> StartAndSubmitAsync(HttpClient student, Guid quizId)
    {
        using var started = await student.PostAsync($"/api/student/quizzes/{quizId}/attempt", null);
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var id = JsonDocument.Parse(await started.Content.ReadAsStringAsync()).RootElement.GetProperty("id").GetGuid();
        using var submitted = await student.PostAsync($"/api/student/attempts/{id}/submit", null);
        Assert.Equal(HttpStatusCode.OK, submitted.StatusCode);
        return id;
    }
}
