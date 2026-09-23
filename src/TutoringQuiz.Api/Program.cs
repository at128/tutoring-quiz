using TutoringQuiz.Api;
using TutoringQuiz.Api.ErrorHandling;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton(TimeProvider.System);

builder.Services
    .AddControllers()
    .AddJsonOptions(options => JsonDefaults.Apply(options.JsonSerializerOptions));
builder.Services.ConfigureHttpJsonOptions(options => JsonDefaults.Apply(options.SerializerOptions));

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ProblemDetailsExceptionHandler>();

var app = builder.Build();

app.UseExceptionHandler();

// Production/Docker: the React build lives in wwwroot and is served from the same origin.
app.UseDefaultFiles();
app.UseStaticFiles();

app.MapControllers();

// Unmatched /api/* routes get a ProblemDetails 404, never index.html.
app.MapFallback("/api/{**path}", ApiNotFound.Handle);
app.MapFallbackToFile("index.html");

app.Run();

public partial class Program;
