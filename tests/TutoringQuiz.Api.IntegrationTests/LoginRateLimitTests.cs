using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;
using TutoringQuiz.Api.RateLimiting;

namespace TutoringQuiz.Api.IntegrationTests;

/// <summary>
/// Sign-in limits: per IP + username against guessing, plus a looser per-IP cap. Every TestServer request comes from
/// the same (unknown) address, like a class on one Wi-Fi.
/// </summary>
public sealed class LoginRateLimitTests
{
    private const string SeedPassword = "Student@2026";

    [Fact]
    public async Task AClassSigningInTogetherFromOneNetwork_IsNotBlocked()
    {
        using var factory = new TestAppFactory(seedEnabled: true, loginPermitsPerMinute: 2, loginPermitsPerMinutePerIp: 30);
        using var client = factory.CreateClient();

        foreach (var username in Enumerable.Range(1, 20).Select(n => $"10a-{n:00}"))
        {
            using var response = await LoginAsync(client, username, SeedPassword);
            Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        }
    }

    [Fact]
    public async Task GuessingOneAccount_IsLimitedPerUsername_WhileClassmatesCanStillSignIn()
    {
        using var factory = new TestAppFactory(seedEnabled: true, loginPermitsPerMinute: 3, loginPermitsPerMinutePerIp: 30);
        using var client = factory.CreateClient();

        for (var i = 0; i < 3; i++)
        {
            using var wrong = await LoginAsync(client, "10a-01", "wrong password");
            Assert.Equal(HttpStatusCode.Unauthorized, wrong.StatusCode);
        }

        // The same account, differently written, shares the limit, even with the right password.
        using var limited = await LoginAsync(client, " 10A-01 ", SeedPassword);
        await AssertRateLimitedAsync(limited);

        using var classmate = await LoginAsync(client, "10a-02", SeedPassword);
        Assert.Equal(HttpStatusCode.OK, classmate.StatusCode);
    }

    [Fact]
    public async Task ManyUsernamesFromOneAddress_HitThePerIpCap()
    {
        using var factory = new TestAppFactory(seedEnabled: true, loginPermitsPerMinute: 100, loginPermitsPerMinutePerIp: 5);
        using var client = factory.CreateClient();

        for (var n = 1; n <= 5; n++)
        {
            using var attempt = await LoginAsync(client, $"no-such-user-{n}", "whatever");
            Assert.Equal(HttpStatusCode.Unauthorized, attempt.StatusCode);
        }

        using var capped = await LoginAsync(client, "10a-01", SeedPassword);
        await AssertRateLimitedAsync(capped);
    }

    [Fact]
    public void TheAccountLimit_IsPerAddress_SoNobodyElsewhereCanLockAStudentOut()
    {
        using var throttle = new LoginThrottle(permitsPerMinute: 2);
        var attacker = IPAddress.Parse("203.0.113.7");
        var centre = IPAddress.Parse("198.51.100.20");

        Assert.True(throttle.TryEnter(attacker, "10a-01", out _));
        Assert.True(throttle.TryEnter(attacker, "10A-01", out _));
        Assert.False(throttle.TryEnter(attacker, "10a-01", out var retryAfter));
        Assert.NotNull(retryAfter);
        Assert.InRange(retryAfter.Value, TimeSpan.FromSeconds(1), TimeSpan.FromMinutes(1));

        Assert.True(throttle.TryEnter(centre, "10a-01", out _));
    }

    private static Task<HttpResponseMessage> LoginAsync(HttpClient client, string username, string password) =>
        client.PostAsJsonAsync("/api/auth/login", new { username, password });

    private static async Task AssertRateLimitedAsync(HttpResponseMessage response)
    {
        Assert.Equal((HttpStatusCode)429, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("rate_limited", body.RootElement.GetProperty("code").GetString());
        Assert.True(response.Headers.RetryAfter?.Delta > TimeSpan.Zero);
        Assert.False(response.Headers.Contains("Set-Cookie"));
    }
}
