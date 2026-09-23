using TutoringQuiz.Application.Common.Abstractions;

namespace TutoringQuiz.Application.Features.TeacherQuizzes;

public sealed class UnpublishTeacherQuizHandler(IAppDbContext db, TeacherQuizAccess access, TimeProvider clock)
{
    public Task<QuizEditorView> HandleAsync(Guid quizId, CancellationToken ct) =>
        db.InWriteTransactionAsync(token => ExecuteAsync(quizId, token), ct);

    private async Task<QuizEditorView> ExecuteAsync(Guid quizId, CancellationToken ct)
    {
        var quiz = await access.OwnedQuizAsync(quizId, ct);
        var hasAttempts = await access.HasAttemptsAsync(quizId, ct);
        var now = clock.GetUtcNow().UtcDateTime;
        quiz.Unpublish(hasAttempts, now);
        await db.SaveChangesAsync(ct);
        var names = await access.ClassNamesAsync(quiz.ClassRooms.Select(c => c.ClassRoomId), ct);
        return TeacherQuizViews.Editor(quiz, names, isLocked: false, now);
    }
}
