using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using TutoringQuiz.Application.Common.Errors;
using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Api.ErrorHandling;

/// <summary>
/// Maps exceptions to ProblemDetails: use-case and domain errors by their code; anything else becomes a 500
/// without a stack trace outside Development.
/// </summary>
public sealed class ProblemDetailsExceptionHandler(
    IProblemDetailsService problemDetails,
    IHostEnvironment environment,
    ILogger<ProblemDetailsExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext httpContext, Exception exception, CancellationToken cancellationToken)
    {
        // The client went away (phone locked, tab closed): nobody is listening for a response.
        if (exception is OperationCanceledException && httpContext.RequestAborted.IsCancellationRequested)
            return true;

        var problem = exception switch
        {
            ValidationException e => ApiProblems.Create(e.Code, e.Message, e.Errors),
            AppException e => ApiProblems.Create(e.Code, e.Message),
            DomainException e => ApiProblems.Create(e.Code, e.Message, e.Errors),
            BadHttpRequestException e => ApiProblems.Create(ErrorCodes.ValidationFailed, e.Message),
            _ => null,
        };

        if (problem is null)
        {
            logger.LogError(exception, "Unhandled exception for {Method} {Path}", httpContext.Request.Method, httpContext.Request.Path);
            problem = ServerError(exception);
        }

        httpContext.Response.StatusCode = problem.Status!.Value;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = httpContext,
            ProblemDetails = problem,
            Exception = exception,
        });
    }

    private ProblemDetails ServerError(Exception exception) => new()
    {
        Status = StatusCodes.Status500InternalServerError,
        Title = "Something went wrong on the server",
        Detail = environment.IsDevelopment() ? exception.ToString() : "Try again. If it keeps happening, tell your teacher.",
    };
}
