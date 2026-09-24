using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Errors;

namespace TutoringQuiz.Application.Features.TeacherQuizzes;

public sealed record ScoreVisibilityRequest(bool? ScoresVisibleToStudents);

/// <summary>
/// Shows or hides scores from students. Allowed in every state, even while students take the quiz: it only changes what
/// student requests return from now on, never a stored score.
/// </summary>
public sealed class SetScoreVisibilityHandler(IAppDbContext db, TeacherQuizAccess access, TimeProvider clock)
{
    public Task<QuizEditorView> HandleAsync(Guid quizId, ScoreVisibilityRequest? request, CancellationToken ct) =>
        db.InWriteTransactionAsync(async token =>
        {
            if (request?.ScoresVisibleToStudents is not { } visible)
                throw new ValidationException(new Dictionary<string, string[]>
                {
                    ["scoresVisibleToStudents"] = ["This field is required."],
                });

            var quiz = await access.OwnedQuizAsync(quizId, token);
            var now = clock.GetUtcNow().UtcDateTime;
            quiz.SetScoresVisibleToStudents(visible, now);
            await db.SaveChangesAsync(token);
            var names = await access.ClassNamesAsync(quiz.ClassRooms.Select(c => c.ClassRoomId), token);
            return TeacherQuizViews.Editor(quiz, names, await access.HasAttemptsAsync(quizId, token), now);
        }, ct);
}
