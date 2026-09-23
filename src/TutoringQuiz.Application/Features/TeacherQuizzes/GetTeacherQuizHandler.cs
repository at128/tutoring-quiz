using TutoringQuiz.Application.Common.Abstractions;

namespace TutoringQuiz.Application.Features.TeacherQuizzes;

public sealed class GetTeacherQuizHandler(TeacherQuizAccess access, TimeProvider clock)
{
    public async Task<QuizEditorView> HandleAsync(Guid quizId, CancellationToken ct)
    {
        var quiz = await access.OwnedQuizAsync(quizId, ct);
        var names = await access.ClassNamesAsync(quiz.ClassRooms.Select(c => c.ClassRoomId), ct);
        var isLocked = await access.HasAttemptsAsync(quiz.Id, ct);
        return TeacherQuizViews.Editor(quiz, names, isLocked, clock.GetUtcNow().UtcDateTime);
    }
}
