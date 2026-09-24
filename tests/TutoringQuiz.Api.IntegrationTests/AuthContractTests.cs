using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;
using TutoringQuiz.Domain.Users;
using TutoringQuiz.Infrastructure.Persistence;

namespace TutoringQuiz.Api.IntegrationTests;

public sealed class AuthContractTests(TestAppFactory factory) : IClassFixture<TestAppFactory>
{
    [Fact] // I15
    public async Task Login_IsCaseInsensitive_SetsHttpOnlyCookie_AndRejectsBadPassword()
    {
        var data = await TestData.CreateAsync(factory);
        using var client = factory.CreateClient();

        using var invalid = await client.PostAsJsonAsync("/api/auth/login",
            new { username = data.Student.Username, password = "wrong password" });
        Assert.Equal(HttpStatusCode.Unauthorized, invalid.StatusCode);
        Assert.Equal("auth.invalid_credentials", await CodeAsync(invalid));

        using var valid = await client.PostAsJsonAsync("/api/auth/login",
            new { username = data.Student.Username.ToUpperInvariant(), password = TestData.StudentPassword });
        Assert.Equal(HttpStatusCode.OK, valid.StatusCode);
        Assert.Contains(valid.Headers.GetValues("Set-Cookie"),
            cookie => cookie.StartsWith("tq.auth=", StringComparison.Ordinal) &&
                      cookie.Contains("httponly", StringComparison.OrdinalIgnoreCase));

        using var me = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.OK, me.StatusCode);
        using var document = JsonDocument.Parse(await me.Content.ReadAsStringAsync());
        Assert.Equal(data.Student.Id, document.RootElement.GetProperty("id").GetGuid());
    }

    [Fact] // I9: student-to-teacher route is covered after teacher endpoints are implemented.
    public async Task StudentEndpoint_RequiresSessionAndStudentRole_WithoutRedirects()
    {
        var data = await TestData.CreateAsync(factory);
        using var anonymous = factory.CreateClient();
        using var unauthenticated = await anonymous.GetAsync("/api/student/quizzes");
        Assert.Equal(HttpStatusCode.Unauthorized, unauthenticated.StatusCode);
        Assert.Equal("auth.unauthenticated", await CodeAsync(unauthenticated));
        Assert.Null(unauthenticated.Headers.Location);

        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var forbidden = await teacher.GetAsync("/api/student/quizzes");
        Assert.Equal(HttpStatusCode.Forbidden, forbidden.StatusCode);
        Assert.Equal("auth.forbidden", await CodeAsync(forbidden));
        Assert.Null(forbidden.Headers.Location);
    }

    [Fact]
    public async Task LoginRateLimit_RejectsExcessRequestsAsProblemDetails()
    {
        using var limitedFactory = new TestAppFactory(loginPermitsPerMinute: 2);
        var data = await TestData.CreateAsync(limitedFactory);
        using var client = limitedFactory.CreateClient();
        for (var i = 0; i < 2; i++)
        {
            using var rejectedPassword = await client.PostAsJsonAsync("/api/auth/login",
                new { username = data.Student.Username, password = "wrong password" });
            Assert.Equal(HttpStatusCode.Unauthorized, rejectedPassword.StatusCode);
        }

        using var limited = await client.PostAsJsonAsync("/api/auth/login",
            new { username = data.Student.Username, password = TestData.StudentPassword });
        Assert.Equal((HttpStatusCode)429, limited.StatusCode);
        Assert.Equal("rate_limited", await CodeAsync(limited));
        Assert.False(limited.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task Logout_ClearsSessionAndIsIdempotent()
    {
        var data = await TestData.CreateAsync(factory);
        using var client = await TestData.LoginAsync(factory, data.Student);
        using var first = await client.PostAsync("/api/auth/logout", null);
        Assert.Equal(HttpStatusCode.NoContent, first.StatusCode);
        using var me = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
        Assert.Equal("auth.unauthenticated", await CodeAsync(me));
        using var second = await client.PostAsync("/api/auth/logout", null);
        Assert.Equal(HttpStatusCode.NoContent, second.StatusCode);
    }

    [Fact]
    public async Task Login_ValidatesMissingAndOversizedFields_AndUnknownUserHasNoSession()
    {
        var data = await TestData.CreateAsync(factory);
        using var client = factory.CreateClient();
        using var missing = await client.PostAsJsonAsync("/api/auth/login", new { username = "  ", password = "" });
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);
        using (var body = JsonDocument.Parse(await missing.Content.ReadAsStringAsync()))
        {
            var errors = body.RootElement.GetProperty("errors");
            Assert.True(errors.TryGetProperty("username", out _));
            Assert.True(errors.TryGetProperty("password", out _));
        }

        using var oversized = await client.PostAsJsonAsync("/api/auth/login",
            new { username = new string('u', 51), password = new string('p', 129) });
        Assert.Equal(HttpStatusCode.BadRequest, oversized.StatusCode);
        using (var body = JsonDocument.Parse(await oversized.Content.ReadAsStringAsync()))
        {
            var errors = body.RootElement.GetProperty("errors");
            Assert.True(errors.TryGetProperty("username", out _));
            Assert.True(errors.TryGetProperty("password", out _));
        }

        using var unknown = await client.PostAsJsonAsync("/api/auth/login",
            new { username = data.Student.Username + ".absent", password = TestData.StudentPassword });
        Assert.Equal(HttpStatusCode.Unauthorized, unknown.StatusCode);
        Assert.Equal("auth.invalid_credentials", await CodeAsync(unknown));
        Assert.False(unknown.Headers.Contains("Set-Cookie"));
        using var me = await client.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, me.StatusCode);
    }

    [Fact]
    public async Task Me_ProjectsRoleAndClass_AndRejectsADeletedSessionUser()
    {
        var data = await TestData.CreateAsync(factory);
        using var student = await TestData.LoginAsync(factory, data.Student);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var studentMe = await student.GetAsync("/api/auth/me");
        using var teacherMe = await teacher.GetAsync("/api/auth/me");
        using (var body = JsonDocument.Parse(await studentMe.Content.ReadAsStringAsync()))
        {
            Assert.Equal("Student", body.RootElement.GetProperty("role").GetString());
            Assert.Equal(data.ClassRoom.Id, body.RootElement.GetProperty("classRoom").GetProperty("id").GetGuid());
        }
        using (var body = JsonDocument.Parse(await teacherMe.Content.ReadAsStringAsync()))
        {
            Assert.Equal("Teacher", body.RootElement.GetProperty("role").GetString());
            Assert.Equal(JsonValueKind.Null, body.RootElement.GetProperty("classRoom").ValueKind);
        }

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Users.Remove((await db.Users.FindAsync(data.Student.Id))!);
            await db.SaveChangesAsync();
        }
        using var staleMe = await student.GetAsync("/api/auth/me");
        Assert.Equal(HttpStatusCode.Unauthorized, staleMe.StatusCode);
        Assert.Equal("auth.unauthenticated", await CodeAsync(staleMe));
        using var staleList = await student.GetAsync("/api/student/quizzes");
        Assert.Equal(HttpStatusCode.Unauthorized, staleList.StatusCode);
        Assert.Equal("auth.unauthenticated", await CodeAsync(staleList));
    }

    [Fact]
    public async Task StudentClassChange_InvalidatesOldCookieBeforeQuizzesCanBeListed()
    {
        var data = await TestData.CreateAsync(factory);
        using var student = await TestData.LoginAsync(factory, data.Student);
        using (var before = await student.GetAsync("/api/student/quizzes"))
            Assert.Equal(HttpStatusCode.OK, before.StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Users.Where(user => user.Id == data.Student.Id)
                .ExecuteUpdateAsync(setters => setters.SetProperty(user => user.ClassRoomId, data.OtherClassRoom.Id));
        }

        using var stale = await student.GetAsync("/api/student/quizzes");
        Assert.Equal(HttpStatusCode.Unauthorized, stale.StatusCode);
        Assert.Equal("auth.unauthenticated", await CodeAsync(stale));

        using var fresh = await TestData.LoginAsync(factory, data.Student);
        using var freshList = await fresh.GetAsync("/api/student/quizzes");
        Assert.Equal(HttpStatusCode.OK, freshList.StatusCode);
    }

    [Fact]
    public async Task TeacherRoleChange_InvalidatesOldTeacherCookie()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using (var before = await teacher.GetAsync("/api/teacher/quizzes"))
            Assert.Equal(HttpStatusCode.OK, before.StatusCode);

        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            await db.Users.Where(user => user.Id == data.Teacher.Id)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(user => user.Role, UserRole.Student)
                    .SetProperty(user => user.ClassRoomId, data.ClassRoom.Id));
        }

        using var stale = await teacher.GetAsync("/api/teacher/quizzes");
        Assert.Equal(HttpStatusCode.Unauthorized, stale.StatusCode);
        Assert.Equal("auth.unauthenticated", await CodeAsync(stale));
    }

    private static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.GetProperty("code").GetString();
    }
}
