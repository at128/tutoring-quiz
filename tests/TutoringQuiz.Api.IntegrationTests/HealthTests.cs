using System.Net;
using System.Net.Http.Json;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;

namespace TutoringQuiz.Api.IntegrationTests;

public sealed class HealthTests(TestAppFactory factory) : IClassFixture<TestAppFactory>
{
    private sealed record HealthResponse(string Status);

    [Fact]
    public async Task Health_ReturnsOk()
    {
        using var client = factory.CreateClient();

        var response = await client.GetAsync("/api/health");

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<HealthResponse>();
        Assert.Equal("ok", body?.Status);
    }
}
