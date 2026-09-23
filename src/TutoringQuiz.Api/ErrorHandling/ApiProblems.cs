using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Api.ErrorHandling;

/// <summary>Builds and writes RFC 9457 ProblemDetails that always carry a <c>code</c>.</summary>
public static class ApiProblems
{
    public static ProblemDetails Create(string code, string? detail, IReadOnlyDictionary<string, string[]>? errors = null)
    {
        var (status, title) = ErrorCatalog.Lookup(code);
        var problem = errors is null
            ? new ProblemDetails()
            : new ValidationProblemDetails(errors.ToDictionary(e => e.Key, e => e.Value));
        problem.Status = status;
        problem.Title = title;
        problem.Detail = detail;
        problem.Extensions["code"] = code;
        return problem;
    }

    /// <summary>Malformed JSON, wrong types or a missing body, caught by model binding before any use case runs.</summary>
    public static ProblemDetails FromModelState(ModelStateDictionary modelState) =>
        Create(
            ErrorCodes.ValidationFailed,
            "The request body is missing or isn't valid JSON for this endpoint.",
            modelState
                .Where(entry => entry.Value is { Errors.Count: > 0 })
                .ToDictionary(
                    entry => entry.Key,
                    entry => entry.Value!.Errors
                        .Select(e => string.IsNullOrEmpty(e.ErrorMessage) ? "This value is invalid." : e.ErrorMessage)
                        .ToArray()));

    public static async Task WriteAsync(HttpContext httpContext, ProblemDetails problem)
    {
        httpContext.Response.StatusCode = problem.Status ?? StatusCodes.Status500InternalServerError;
        var writer = httpContext.RequestServices.GetRequiredService<IProblemDetailsService>();
        await writer.WriteAsync(new ProblemDetailsContext { HttpContext = httpContext, ProblemDetails = problem });
    }
}
