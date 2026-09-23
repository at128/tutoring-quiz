using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;
using TutoringQuiz.Domain.Users;
using TutoringQuiz.Infrastructure.Persistence;

namespace TutoringQuiz.Api.IntegrationTests;

public sealed class SeededRuntimeTests
{
    [Fact]
    public async Task FreshDatabase_MigratesSeedsAndSupportsBothRoles()
    {
        using var factory = new TestAppFactory(seedEnabled: true);
        using var client = factory.CreateClient();
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(60, await db.Users.CountAsync(u => u.Role == UserRole.Student));
        Assert.Equal(4, await db.Users.CountAsync(u => u.Role == UserRole.Teacher));
        Assert.Equal(5, await db.Quizzes.CountAsync());
        Assert.True(await db.QuizAttempts.AnyAsync());

        using var studentLogin = await client.PostAsJsonAsync("/api/auth/login",
            new { username = "10a-01", password = "Student@2026" });
        Assert.Equal(HttpStatusCode.OK, studentLogin.StatusCode);
        using var studentList = await client.GetAsync("/api/student/quizzes");
        Assert.Equal(HttpStatusCode.OK, studentList.StatusCode);
        using (var document = JsonDocument.Parse(await studentList.Content.ReadAsStringAsync()))
            Assert.NotEmpty(document.RootElement.GetProperty("quizzes").EnumerateArray());

        using var teacher = factory.CreateClient();
        using var teacherLogin = await teacher.PostAsJsonAsync("/api/auth/login",
            new { username = "teacher.reem", password = "Teacher@2026" });
        Assert.Equal(HttpStatusCode.OK, teacherLogin.StatusCode);
        using var quizzes = await teacher.GetAsync("/api/teacher/quizzes");
        Assert.Equal(HttpStatusCode.OK, quizzes.StatusCode);
        using var quizDocument = JsonDocument.Parse(await quizzes.Content.ReadAsStringAsync());
        Assert.NotEmpty(quizDocument.RootElement.EnumerateArray());
        var quizId = quizDocument.RootElement[0].GetProperty("id").GetGuid();
        using var results = await teacher.GetAsync($"/api/teacher/quizzes/{quizId}/results");
        Assert.Equal(HttpStatusCode.OK, results.StatusCode);
    }
}
