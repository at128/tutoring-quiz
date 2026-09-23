using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using TutoringQuiz.Application.Features.StudentQuizzes;

namespace TutoringQuiz.Api.Controllers;

[ApiController]
[Authorize(Roles = "Student")]
[Route("api/student/quizzes")]
public sealed class StudentQuizzesController : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<StudentQuizList>> List([FromServices] ListStudentQuizzesHandler handler, CancellationToken ct) =>
        Ok(await handler.HandleAsync(ct));
}
