using TutoringQuiz.Application.Common.Abstractions;

namespace TutoringQuiz.Application.Features.TeacherQuizzes;

public sealed class DeleteTeacherQuizHandler(IAppDbContext db, TeacherQuizAccess access)
{
    public Task HandleAsync(Guid quizId, CancellationToken ct) =>
        db.InWriteTransactionAsync(token => ExecuteAsync(quizId, token), ct);

    private async Task ExecuteAsync(Guid quizId, CancellationToken ct)
    {
        var quiz = await access.OwnedQuizAsync(quizId, ct);
        quiz.EnsureCanBeDeleted(await access.HasAttemptsAsync(quizId, ct));
        db.Quizzes.Remove(quiz);
        await db.SaveChangesAsync(ct);
    }
}
