using Microsoft.EntityFrameworkCore;
using TutoringQuiz.Application.Common.Abstractions;

namespace TutoringQuiz.Application.Features.TeacherQuizzes;

/// <summary>
/// Saves the teacher's edit. When students already have attempts (allowed only once the quiz has closed, see
/// <c>Quiz.Update</c>), every attempt is scored again against the corrected quiz in the same transaction and the
/// same save, so the new quiz and the new results are committed together or not at all.
/// </summary>
public sealed class UpdateTeacherQuizHandler(IAppDbContext db, TeacherQuizAccess access, TimeProvider clock)
{
    public Task<QuizEditorView> HandleAsync(Guid quizId, QuizUpsert? request, CancellationToken ct) =>
        db.InWriteTransactionAsync(token => ExecuteAsync(quizId, request, token), ct);

    private async Task<QuizEditorView> ExecuteAsync(Guid quizId, QuizUpsert? request, CancellationToken ct)
    {
        var quiz = await access.OwnedQuizAsync(quizId, ct);
        var hasAttempts = await access.HasAttemptsAsync(quizId, ct);
        var draft = QuizUpsertMapper.Map(request);
        var names = await access.ValidateClassRoomsAsync(draft.ClassRoomIds, ct);
        var now = clock.GetUtcNow().UtcDateTime;
        quiz.Update(draft.Details, draft.ClassRoomIds, draft.Questions, hasAttempts, now);

        if (hasAttempts)
        {
            var attempts = await db.QuizAttempts.Include(a => a.Answers)
                .Where(a => a.QuizId == quizId).ToListAsync(ct);
            foreach (var attempt in attempts)
            {
                // The quiz is closed, so an attempt still marked in progress is past its deadline: finish it first.
                if (!attempt.FinalizeIfExpired(quiz, now)) attempt.Regrade(quiz, now);
            }
        }

        await db.SaveChangesAsync(ct);
        return TeacherQuizViews.Editor(quiz, names, hasAttempts, now);
    }
}
