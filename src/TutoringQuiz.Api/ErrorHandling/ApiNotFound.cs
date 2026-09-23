using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Api.ErrorHandling;

public static class ApiNotFound
{
    /// <summary>Unmatched <c>/api/*</c> routes (including malformed ids) get a ProblemDetails 404, never index.html.</summary>
    public static Task Handle(HttpContext context) =>
        ApiProblems.WriteAsync(context, ApiProblems.Create(
            ErrorCodes.NotFound,
            $"There is no API endpoint at {context.Request.Method} {context.Request.Path}."));
}
