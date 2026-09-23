using TutoringQuiz.Api;
using TutoringQuiz.Api.Auth;
using TutoringQuiz.Api.ErrorHandling;
using TutoringQuiz.Api.RateLimiting;
using TutoringQuiz.Application;
using TutoringQuiz.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);
builder.Services.AddApiEndpoints();
builder.Services.AddCookieAuth(builder.Configuration);
builder.Services.AddLoginRateLimit(builder.Configuration);

var app = builder.Build();

await app.Services.InitializeDatabaseAsync();

app.UseExceptionHandler();

// Production/Docker: the React build lives in wwwroot and is served from the same origin.
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

// Unmatched /api/* routes get a ProblemDetails 404, never index.html.
app.MapFallback("/api/{**path}", ApiNotFound.Handle).AllowAnonymous();
app.MapFallbackToFile("index.html").AllowAnonymous();

app.Run();

public partial class Program;
