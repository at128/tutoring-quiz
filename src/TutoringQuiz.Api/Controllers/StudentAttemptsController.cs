using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TutoringQuiz.Application.Common.Errors;
using TutoringQuiz.Application.Features.Attempts;

namespace TutoringQuiz.Api.Controllers;

public sealed class SaveAnswerRequest
{
    /// <summary>The property must be present; an explicit null clears the answer.</summary>
    [JsonRequired]
    public Guid? SelectedOptionId { get; init; }
}

[ApiController]
[Authorize(Roles = "Student")]
[Route("api/student")]
public sealed class StudentAttemptsController : ControllerBase
{
    [HttpPost("quizzes/{quizId:guid}/attempt")]
    public async Task<ActionResult<AttemptView>> Start(
        Guid quizId, [FromServices] StartAttemptHandler handler, CancellationToken ct)
    {
        var outcome = await handler.HandleAsync(quizId, ct);
        return outcome.Created ? StatusCode(StatusCodes.Status201Created, outcome.Attempt) : Ok(outcome.Attempt);
    }

    [HttpGet("attempts/{attemptId:guid}")]
    public async Task<ActionResult<AttemptView>> Get(
        Guid attemptId, [FromServices] GetAttemptHandler handler, CancellationToken ct) =>
        Ok(await handler.HandleAsync(attemptId, ct));

    [HttpPut("attempts/{attemptId:guid}/answers/{questionId:guid}")]
    [Consumes("application/json")]
    public async Task<ActionResult<SaveAnswerResponse>> SaveAnswer(
        Guid attemptId, Guid questionId, [FromBody] SaveAnswerRequest? request,
        [FromServices] SaveAnswerHandler handler, CancellationToken ct)
    {
        if (request is null)
            throw new ValidationException(new Dictionary<string, string[]>
            {
                ["selectedOptionId"] = ["Provide an option ID, or null to clear the answer."],
            });
        return Ok(await handler.HandleAsync(attemptId, questionId, request.SelectedOptionId, ct));
    }

    [HttpPost("attempts/{attemptId:guid}/submit")]
    public async Task<ActionResult<AttemptResult>> Submit(
        Guid attemptId, [FromServices] SubmitAttemptHandler handler, CancellationToken ct) =>
        Ok(await handler.HandleAsync(attemptId, ct));

    [HttpGet("attempts/{attemptId:guid}/result")]
    public async Task<ActionResult<AttemptResult>> Result(
        Guid attemptId, [FromServices] GetAttemptResultHandler handler, CancellationToken ct) =>
        Ok(await handler.HandleAsync(attemptId, ct));
}
