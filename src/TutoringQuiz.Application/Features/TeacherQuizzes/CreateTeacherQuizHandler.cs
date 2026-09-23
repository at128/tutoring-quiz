using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Application.Features.TeacherQuizzes;

public sealed class CreateTeacherQuizHandler(IAppDbContext db, TeacherQuizAccess access, TimeProvider clock)
{
    public async Task<Guid> HandleAsync(QuizUpsert? request, CancellationToken ct)
    {
        var teacherId = access.TeacherId;
        var draft = QuizUpsertMapper.Map(request);
        await access.ValidateClassRoomsAsync(draft.ClassRoomIds, ct);
        var quiz = Quiz.Create(teacherId, draft.Details, draft.ClassRoomIds,
            draft.Questions, clock.GetUtcNow().UtcDateTime);
        db.Quizzes.Add(quiz);
        await db.SaveChangesAsync(ct);
        return quiz.Id;
    }
}
