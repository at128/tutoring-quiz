using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TutoringQuiz.Application.Features.Results;
using TutoringQuiz.Application.Features.TeacherQuizzes;

namespace TutoringQuiz.Api.Controllers;

[ApiController]
[Authorize(Roles = "Teacher")]
[Route("api/teacher")]
public sealed class TeacherQuizzesController : ControllerBase
{
    [HttpGet("classrooms")]
    public async Task<ActionResult<IReadOnlyList<TeacherClassRoom>>> ClassRooms(
        [FromServices] ListClassRoomsHandler handler, CancellationToken ct) =>
        Ok(await handler.HandleAsync(ct));

    [HttpGet("quizzes")]
    public async Task<ActionResult<IReadOnlyList<TeacherQuizSummary>>> List(
        [FromServices] ListTeacherQuizzesHandler handler, CancellationToken ct) =>
        Ok(await handler.HandleAsync(ct));

    [HttpPost("quizzes")]
    [Consumes("application/json")]
    public async Task<IActionResult> Create(
        [FromBody] QuizUpsert? request, [FromServices] CreateTeacherQuizHandler handler, CancellationToken ct)
    {
        var id = await handler.HandleAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id }, new { id });
    }

    [HttpGet("quizzes/{id:guid}")]
    public async Task<ActionResult<QuizEditorView>> Get(
        Guid id, [FromServices] GetTeacherQuizHandler handler, CancellationToken ct) =>
        Ok(await handler.HandleAsync(id, ct));

    [HttpPut("quizzes/{id:guid}")]
    [Consumes("application/json")]
    public async Task<ActionResult<QuizEditorView>> Update(
        Guid id, [FromBody] QuizUpsert? request,
        [FromServices] UpdateTeacherQuizHandler handler, CancellationToken ct) =>
        Ok(await handler.HandleAsync(id, request, ct));

    [HttpPost("quizzes/{id:guid}/publish")]
    public async Task<ActionResult<QuizEditorView>> Publish(
        Guid id, [FromServices] PublishTeacherQuizHandler handler, CancellationToken ct) =>
        Ok(await handler.HandleAsync(id, ct));

    [HttpPost("quizzes/{id:guid}/unpublish")]
    public async Task<ActionResult<QuizEditorView>> Unpublish(
        Guid id, [FromServices] UnpublishTeacherQuizHandler handler, CancellationToken ct) =>
        Ok(await handler.HandleAsync(id, ct));

    [HttpDelete("quizzes/{id:guid}")]
    public async Task<IActionResult> Delete(
        Guid id, [FromServices] DeleteTeacherQuizHandler handler, CancellationToken ct)
    {
        await handler.HandleAsync(id, ct);
        return NoContent();
    }

    [HttpGet("quizzes/{id:guid}/results")]
    public async Task<ActionResult<QuizResults>> Results(
        Guid id, [FromServices] GetQuizResultsHandler handler, CancellationToken ct) =>
        Ok(await handler.HandleAsync(id, ct));
}
