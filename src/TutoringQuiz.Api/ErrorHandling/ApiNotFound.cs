namespace TutoringQuiz.Api.ErrorHandling;

public static class ApiNotFound
{
    public static IResult Handle(HttpContext context) =>
        Results.Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "Not found",
            detail: $"There is no API endpoint at {context.Request.Method} {context.Request.Path}.",
            extensions: new Dictionary<string, object?> { ["code"] = "not_found" });
}
