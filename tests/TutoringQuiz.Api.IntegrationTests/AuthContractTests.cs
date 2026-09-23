using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;

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

    private static async Task<string?> CodeAsync(HttpResponseMessage response)
    {
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var document = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        return document.RootElement.GetProperty("code").GetString();
    }
}
