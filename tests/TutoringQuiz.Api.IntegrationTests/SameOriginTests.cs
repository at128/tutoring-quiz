using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TutoringQuiz.Api.Auth;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;
using TutoringQuiz.Infrastructure.Persistence;

namespace TutoringQuiz.Api.IntegrationTests;

/// <summary>M4-01: API changes are accepted only from this site's own pages (CSRF).</summary>
public sealed class SameOriginTests(TestAppFactory factory) : IClassFixture<TestAppFactory>
{
    // TestServer requests arrive as http://localhost.
    private const string OwnOrigin = "http://localhost";

    [Theory]
    [InlineData("cross-site")]
    [InlineData("same-site")] // a sibling subdomain: SameSite=Strict alone lets its requests carry the cookie
    [InlineData("none")]
    public async Task PublishLabelledFromAnotherSite_IsForbidden_AndTheQuizStaysADraft(string fetchSite)
    {
        var data = await TestData.CreateAsync(factory, published: false);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/teacher/quizzes/{data.Quiz.Id}/publish");
        request.Headers.Add(SameOriginGuard.FetchSiteHeader, fetchSite);

        using var response = await teacher.SendAsync(request);

        await AssertBlockedAsync(response);
        using var quiz = await teacher.GetAsync($"/api/teacher/quizzes/{data.Quiz.Id}");
        Assert.False((await JsonAsync(quiz)).GetProperty("isPublished").GetBoolean());
    }

    [Theory] // Older browsers send only Origin; a plain HTML form posts without a JSON body.
    [InlineData("https://evil.example")]
    [InlineData("null")]
    [InlineData("http://localhost:5173")] // another port is another origin
    [InlineData("https://localhost")] // and so is another scheme
    public async Task FormPostToStartFromAForeignOrigin_IsForbidden_AndStartsNothing(string origin)
    {
        var data = await TestData.CreateAsync(factory);
        using var student = await TestData.LoginAsync(factory, data.Student);
        using var request = new HttpRequestMessage(HttpMethod.Post, $"/api/student/quizzes/{data.Quiz.Id}/attempt")
        {
            Content = new FormUrlEncodedContent([]),
        };
        request.Headers.Add("Origin", origin);

        using var response = await student.SendAsync(request);

        await AssertBlockedAsync(response);
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.False(await db.QuizAttempts.AnyAsync(a => a.StudentId == data.Student.Id));
    }

    [Fact]
    public async Task CrossSiteSignIn_IsForbidden()
    {
        var data = await TestData.CreateAsync(factory);
        using var client = factory.CreateClient();
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/auth/login")
        {
            Content = JsonContent.Create(new { username = data.Student.Username, password = TestData.StudentPassword }),
        };
        request.Headers.Add(SameOriginGuard.FetchSiteHeader, "cross-site");

        using var response = await client.SendAsync(request);

        await AssertBlockedAsync(response);
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }

    [Fact]
    public async Task TheSitesOwnPages_CanChangeThings()
    {
        var data = await TestData.CreateAsync(factory, published: false);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);

        using var publish = new HttpRequestMessage(HttpMethod.Post, $"/api/teacher/quizzes/{data.Quiz.Id}/publish");
        publish.Headers.Add(SameOriginGuard.FetchSiteHeader, "same-origin");
        publish.Headers.Add("Origin", OwnOrigin);
        using (var published = await teacher.SendAsync(publish))
            Assert.Equal(HttpStatusCode.OK, published.StatusCode);

        using var start = new HttpRequestMessage(HttpMethod.Post, $"/api/student/quizzes/{data.Quiz.Id}/attempt");
        start.Headers.Add("Origin", OwnOrigin); // an older browser: Origin only
        using (var started = await student.SendAsync(start))
            Assert.Equal(HttpStatusCode.Created, started.StatusCode);
    }

    [Fact]
    public async Task ReadingFromALinkOnAnotherSite_IsNotBlocked()
    {
        var data = await TestData.CreateAsync(factory);
        using var student = await TestData.LoginAsync(factory, data.Student);
        using var request = new HttpRequestMessage(HttpMethod.Get, "/api/student/quizzes");
        request.Headers.Add(SameOriginGuard.FetchSiteHeader, "cross-site");

        using var response = await student.SendAsync(request);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Theory]
    [InlineData("POST", "cross-site", null, true)]
    [InlineData("PUT", "same-site", null, true)]
    [InlineData("PATCH", "none", null, true)]
    [InlineData("DELETE", "cross-site", "http://localhost", true)] // the browser's label wins over a matching Origin
    [InlineData("POST", "same-origin", "https://evil.example", false)] // only a browser sets Sec-Fetch-Site
    [InlineData("POST", "SAME-ORIGIN", null, false)]
    [InlineData("POST", "same-origin, cross-site", null, true)] // a doubled header is not trusted
    [InlineData("POST", null, "http://localhost:80", false)]
    [InlineData("POST", null, "HTTP://LOCALHOST", false)]
    [InlineData("POST", null, "http://localhost.evil.example", true)]
    [InlineData("POST", null, "not a url", true)]
    [InlineData("POST", null, null, false)] // curl, scripts and tests: no browser, so no victim's cookie
    [InlineData("GET", "cross-site", "https://evil.example", false)]
    [InlineData("HEAD", "cross-site", null, false)]
    [InlineData("OPTIONS", "cross-site", null, false)]
    public void IsForeign_ForLocalhost(string method, string? fetchSite, string? origin, bool expected) =>
        Assert.Equal(expected, SameOriginGuard.IsForeign(method, fetchSite, origin, "http", new HostString("localhost")));

    [Theory] // Behind the TLS proxy, forwarded headers make the request https on the public host.
    [InlineData("https://quiz.example.com", false)]
    [InlineData("https://quiz.example.com:443", false)]
    [InlineData("http://quiz.example.com", true)]
    [InlineData("https://quiz.example.com:8443", true)]
    [InlineData("https://other.example.com", true)]
    public void IsForeign_BehindTheProxy(string origin, bool expected) =>
        Assert.Equal(expected, SameOriginGuard.IsForeign("POST", null, origin, "https", new HostString("quiz.example.com")));

    [Theory] // A phone on the LAN: http://<IP>:8080.
    [InlineData("http://192.168.1.20:8080", false)]
    [InlineData("http://192.168.1.20", true)]
    public void IsForeign_OnALanAddressWithAPort(string origin, bool expected) =>
        Assert.Equal(expected, SameOriginGuard.IsForeign("POST", null, origin, "http", new HostString("192.168.1.20:8080")));

    private static async Task AssertBlockedAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal("auth.forbidden", (await JsonAsync(response)).GetProperty("code").GetString());
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();
}
