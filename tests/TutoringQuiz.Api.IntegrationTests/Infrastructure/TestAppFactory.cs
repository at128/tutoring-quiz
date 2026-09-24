using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Time.Testing;

namespace TutoringQuiz.Api.IntegrationTests.Infrastructure;

public sealed class TestAppFactory : WebApplicationFactory<Program>
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"tq-{Guid.NewGuid():N}.db");
    private readonly int _loginPermitsPerMinute;
    private readonly int _loginPermitsPerMinutePerIp;
    private readonly bool _seedEnabled;

    public TestAppFactory() : this(seedEnabled: false, loginPermitsPerMinute: 1000) { }

    /// <param name="loginPermitsPerMinute">Per IP + username.</param>
    /// <param name="loginPermitsPerMinutePerIp">Per IP; every test client shares one address.</param>
    internal TestAppFactory(int loginPermitsPerMinute, int loginPermitsPerMinutePerIp = 1000)
        : this(seedEnabled: false, loginPermitsPerMinute, loginPermitsPerMinutePerIp) { }

    internal TestAppFactory(bool seedEnabled, int loginPermitsPerMinute = 1000, int loginPermitsPerMinutePerIp = 1000)
    {
        _seedEnabled = seedEnabled;
        _loginPermitsPerMinute = loginPermitsPerMinute;
        _loginPermitsPerMinutePerIp = loginPermitsPerMinutePerIp;
    }

    public FakeTimeProvider Clock { get; } = new(new DateTimeOffset(2026, 9, 24, 10, 0, 0, TimeSpan.Zero));
    public string DatabasePath => _databasePath;
    public string ConnectionString => $"Data Source={_databasePath};Pooling=False";

    protected override IHost CreateHost(IHostBuilder builder)
    {
        // These values must be available when Program calls WebApplication.CreateBuilder(args), before Build().
        builder.ConfigureHostConfiguration(configuration => configuration.AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["ConnectionStrings:Default"] = ConnectionString,
                ["Seed:Enabled"] = _seedEnabled.ToString(),
                ["RateLimiting:LoginPermitsPerMinute"] = _loginPermitsPerMinute.ToString(),
                ["RateLimiting:LoginPermitsPerMinutePerIp"] = _loginPermitsPerMinutePerIp.ToString(),
            }));
        return base.CreateHost(builder);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        builder.ConfigureTestServices(services =>
        {
            services.RemoveAll<TimeProvider>();
            services.AddSingleton<TimeProvider>(Clock);
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (!disposing) return;

        // SQLite WAL uses sidecar files; remove only the files created for this factory.
        SqliteConnection.ClearAllPools();
        foreach (var path in new[] { _databasePath, _databasePath + "-wal", _databasePath + "-shm" })
            if (File.Exists(path)) File.Delete(path);
    }
}
