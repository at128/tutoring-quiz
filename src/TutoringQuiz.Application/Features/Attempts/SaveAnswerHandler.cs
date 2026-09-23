using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Application.Common.Errors;
using TutoringQuiz.Application.Common.Persistence;
using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Application.Features.Attempts;

public sealed record SaveAnswerResponse(Guid QuestionId, Guid? SelectedOptionId, DateTime SavedAt);

/// <summary>Validates the owned attempt, deadline, question and option before changing a stored answer.</summary>
public sealed class SaveAnswerHandler(
    IAppDbContext db, StudentAttemptAccess access, AttemptFinalizer finalizer, TimeProvider clock)
{
    public Task<SaveAnswerResponse> HandleAsync(
        Guid attemptId, Guid questionId, Guid? selectedOptionId, CancellationToken ct) =>
        db.RunWithRetryOnConflictAsync(async token =>
        {
            try
            {
                return await ExecuteAsync(attemptId, questionId, selectedOptionId, token);
            }
            catch (DuplicateKeyException)
            {
                // Two tabs inserted an answer to the same question. Reload and let the last valid write win.
                db.ChangeTracker.Clear();
                return await ExecuteAsync(attemptId, questionId, selectedOptionId, token);
            }
        }, ct);

    private async Task<SaveAnswerResponse> ExecuteAsync(
        Guid attemptId, Guid questionId, Guid? selectedOptionId, CancellationToken ct)
    {
        var (attempt, quiz) = await access.OwnedAttemptAsync(attemptId, ct);
        var now = clock.GetUtcNow().UtcDateTime;

        if (await finalizer.FinalizeIfExpiredAsync(attempt, quiz, now, ct) > 0)
            throw new ConflictException(ErrorCodes.AttemptDeadlinePassed, "Time is up. This answer was not saved.");
        if (attempt.IsFinalized)
            throw new ConflictException(ErrorCodes.AttemptNotInProgress, "This attempt is already finished.");

        var question = quiz.Questions.FirstOrDefault(q => q.Id == questionId)
            ?? throw new DomainException(ErrorCodes.AnswerInvalidOption, "This question is not part of the quiz.");
        var answer = attempt.SaveAnswer(question, selectedOptionId, now);
        await db.SaveChangesAsync(ct);
        return new SaveAnswerResponse(questionId, answer.SelectedOptionId, answer.AnsweredAtUtc);
    }
}
