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
            // Acquire the write lock before checking the server clock: waiting on another writer cannot
            // turn an on-time decision into a write that starts after the deadline.
            var outcome = await db.InWriteTransactionAsync(inner =>
                ExecuteAsync(attemptId, questionId, selectedOptionId, inner), token);
            return outcome switch
            {
                SaveOutcome.Saved saved => saved.Response,
                SaveOutcome.Expired => throw new ConflictException(
                    ErrorCodes.AttemptDeadlinePassed, "Time is up. This answer was not saved."),
                _ => throw new InvalidOperationException("Unknown answer-save outcome."),
            };
        }, ct);

    private abstract record SaveOutcome
    {
        public sealed record Saved(SaveAnswerResponse Response) : SaveOutcome;
        public sealed record Expired : SaveOutcome;
    }

    private async Task<SaveOutcome> ExecuteAsync(
        Guid attemptId, Guid questionId, Guid? selectedOptionId, CancellationToken ct)
    {
        var (attempt, quiz) = await access.OwnedAttemptAsync(attemptId, ct);
        var now = clock.GetUtcNow().UtcDateTime;

        if (await finalizer.FinalizeIfExpiredAsync(attempt, quiz, now, ct) > 0)
            return new SaveOutcome.Expired(); // Commit Expired before returning 409.
        if (attempt.IsFinalized)
            throw new ConflictException(ErrorCodes.AttemptNotInProgress, "This attempt is already finished.");

        var question = quiz.Questions.FirstOrDefault(q => q.Id == questionId)
            ?? throw new DomainException(ErrorCodes.AnswerInvalidOption, "This question is not part of the quiz.");
        var answer = attempt.SaveAnswer(question, selectedOptionId, now);
        await db.SaveChangesAsync(ct);
        return new SaveOutcome.Saved(new SaveAnswerResponse(questionId, answer.SelectedOptionId, answer.AnsweredAtUtc));
    }
}
