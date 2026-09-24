using TutoringQuiz.Application.Common.Abstractions;

namespace TutoringQuiz.Application.Features.TeacherQuizzes;

public sealed class PublishTeacherQuizHandler(IAppDbContext db, TeacherQuizAccess access, TimeProvider clock)
{
    public Task<QuizEditorView> HandleAsync(Guid quizId, CancellationToken ct) =>
        db.InWriteTransactionAsync(token => ExecuteAsync(quizId, token), ct);

    private async Task<QuizEditorView> ExecuteAsync(Guid quizId, CancellationToken ct)
    {
        var quiz = await access.OwnedQuizAsync(quizId, ct);
        var now = clock.GetUtcNow().UtcDateTime;
        var wasPublished = quiz.IsPublished;
        quiz.Publish(now);
        if (!wasPublished) await db.SaveChangesAsync(ct);
        var names = await access.ClassNamesAsync(quiz.ClassRooms.Select(c => c.ClassRoomId), ct);
        var hasAttempts = await access.HasAttemptsAsync(quizId, ct);
        return TeacherQuizViews.Editor(quiz, names, hasAttempts, now);
    }
}
