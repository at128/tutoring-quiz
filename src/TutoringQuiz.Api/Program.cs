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

// Production/Docker: the React build lives in wwwroot and is served from the same origin. The page itself is always
// revalidated, so a browser never keeps running the previous build after a deploy; the build's assets carry a content
// hash in their names, so they can be cached for good.
var spaFiles = new StaticFileOptions
{
    OnPrepareResponse = context =>
    {
        if (context.File.Name.EndsWith(".html", StringComparison.OrdinalIgnoreCase))
            context.Context.Response.Headers.CacheControl = "no-cache";
        else if (context.Context.Request.Path.StartsWithSegments("/assets"))
            context.Context.Response.Headers.CacheControl = "public, max-age=31536000, immutable";
    },
};
app.UseDefaultFiles();
app.UseStaticFiles(spaFiles);

// CSRF: API changes only from this site's own pages.
app.UseSameOriginApi();

app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.MapControllers();

// Unmatched /api/* routes get a ProblemDetails 404, never index.html.
app.MapFallback("/api/{**path}", ApiNotFound.Handle).AllowAnonymous();
app.MapFallbackToFile("index.html", spaFiles).AllowAnonymous();

app.Run();

public partial class Program;
