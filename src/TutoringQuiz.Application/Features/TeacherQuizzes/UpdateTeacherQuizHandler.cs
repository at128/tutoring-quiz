using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Application.Features.TeacherQuizzes;

public sealed class UpdateTeacherQuizHandler(IAppDbContext db, TeacherQuizAccess access, TimeProvider clock)
{
    public Task<QuizEditorView> HandleAsync(Guid quizId, QuizUpsert? request, CancellationToken ct) =>
        db.InWriteTransactionAsync(token => ExecuteAsync(quizId, request, token), ct);

    private async Task<QuizEditorView> ExecuteAsync(Guid quizId, QuizUpsert? request, CancellationToken ct)
    {
        var quiz = await access.OwnedQuizAsync(quizId, ct);
        if (await access.HasAttemptsAsync(quizId, ct))
            throw new DomainException(ErrorCodes.QuizLocked,
                "Students have already started this quiz, so its content can no longer change.");

        var draft = QuizUpsertMapper.Map(request);
        var names = await access.ValidateClassRoomsAsync(draft.ClassRoomIds, ct);
        var now = clock.GetUtcNow().UtcDateTime;
        quiz.Update(draft.Details, draft.ClassRoomIds, draft.Questions, hasAttempts: false, now);
        await db.SaveChangesAsync(ct);
        return TeacherQuizViews.Editor(quiz, names, isLocked: false, now);
    }
}
