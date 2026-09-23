using TutoringQuiz.Application.Common.Errors;
using TutoringQuiz.Application.Common.Validation;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Application.Features.TeacherQuizzes;

public sealed record QuizUpsert(
    string? Title, string? Description, IReadOnlyList<Guid>? ClassRoomIds,
    DateTime? OpensAt, DateTime? ClosesAt, int? DurationMinutes,
    int? WrongAnswerPenaltyPercent, IReadOnlyList<QuestionUpsert?>? Questions);

public sealed record QuestionUpsert(string? Text, int? Points, IReadOnlyList<OptionUpsert?>? Options);

public sealed record OptionUpsert(string? Text, bool? IsCorrect);

internal sealed record QuizDraftData(
    QuizDetails Details, IReadOnlyList<Guid> ClassRoomIds, IReadOnlyList<QuestionDraft> Questions);

/// <summary>Pure request-shape validation and mapping; domain rules stay in QuizRules.</summary>
internal static class QuizUpsertMapper
{
    public static QuizDraftData Map(QuizUpsert? request)
    {
        if (request is null)
            throw new ValidationException(new Dictionary<string, string[]> { ["body"] = ["Provide quiz details."] });

        var errors = new List<FieldError>();
        void Require(bool missing, string field) =>
            errors.AddRange(FieldErrors.When(missing, field, "This field is required."));

        Require(request.Title is null, "title");
        Require(request.ClassRoomIds is null, "classRoomIds");
        Require(request.OpensAt is null, "opensAt");
        Require(request.ClosesAt is null, "closesAt");
        Require(request.DurationMinutes is null, "durationMinutes");
        Require(request.WrongAnswerPenaltyPercent is null, "wrongAnswerPenaltyPercent");
        Require(request.Questions is null, "questions");

        if (request.OpensAt is { Kind: not DateTimeKind.Utc })
            errors.Add(new FieldError("opensAt", "Use an ISO-8601 UTC time ending in Z."));
        if (request.ClosesAt is { Kind: not DateTimeKind.Utc })
            errors.Add(new FieldError("closesAt", "Use an ISO-8601 UTC time ending in Z."));
        if (request.ClassRoomIds is { } classIds)
        {
            errors.AddRange(FieldErrors.When(classIds.Any(id => id == Guid.Empty),
                "classRoomIds", "Class IDs must not be empty."));
            errors.AddRange(FieldErrors.When(classIds.Count != classIds.Distinct().Count(),
                "classRoomIds", "Choose each class only once."));
        }

        if (request.Questions is { } questions)
        {
            for (var i = 0; i < questions.Count; i++)
            {
                var question = questions[i];
                var prefix = $"questions[{i}]";
                Require(question is null, prefix);
                if (question is null) continue;
                Require(question.Text is null, $"{prefix}.text");
                Require(question.Points is null, $"{prefix}.points");
                Require(question.Options is null, $"{prefix}.options");
                if (question.Options is null) continue;
                for (var j = 0; j < question.Options.Count; j++)
                {
                    var option = question.Options[j];
                    var optionPrefix = $"{prefix}.options[{j}]";
                    Require(option is null, optionPrefix);
                    if (option is null) continue;
                    Require(option.Text is null, $"{optionPrefix}.text");
                    Require(option.IsCorrect is null, $"{optionPrefix}.isCorrect");
                }
            }
        }

        FieldErrors.ThrowIfAny(errors);

        return new QuizDraftData(
            new QuizDetails(request.Title!, request.Description,
                request.OpensAt!.Value, request.ClosesAt!.Value,
                request.DurationMinutes!.Value, request.WrongAnswerPenaltyPercent!.Value),
            request.ClassRoomIds!,
            request.Questions!.Select(q => new QuestionDraft(q!.Text!, q.Points!.Value,
                q.Options!.Select(o => new OptionDraft(o!.Text!, o.IsCorrect!.Value)).ToList())).ToList());
    }
}
