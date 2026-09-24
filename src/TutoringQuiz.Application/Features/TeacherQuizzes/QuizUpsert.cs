using TutoringQuiz.Application.Common.Errors;
using TutoringQuiz.Application.Common.Validation;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Application.Features.TeacherQuizzes;

public sealed record QuizUpsert(
    string? Title, string? Description, IReadOnlyList<Guid>? ClassRoomIds,
    DateTime? OpensAt, DateTime? ClosesAt, int? DurationMinutes,
    int? WrongAnswerPenaltyPercent, IReadOnlyList<QuestionUpsert?>? Questions,
    decimal? WrongAnswerPenaltyPoints = null, // optional: a fixed deduction instead of a percentage
    bool? ScoresVisibleToStudents = null); // optional, true when left out

/// <param name="Id">An existing question of this quiz to update in place (students' answers stay attached); leave it
/// out for a new question. An id the quiz doesn't have also makes a new question.</param>
public sealed record QuestionUpsert(string? Text, int? Points, IReadOnlyList<OptionUpsert?>? Options, Guid? Id = null);

/// <param name="Id">An existing option of the same question to update in place.</param>
public sealed record OptionUpsert(string? Text, bool? IsCorrect, Guid? Id = null);

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
                request.DurationMinutes!.Value, request.WrongAnswerPenaltyPercent!.Value,
                request.WrongAnswerPenaltyPoints, request.ScoresVisibleToStudents ?? true),
            request.ClassRoomIds!,
            request.Questions!.Select(q => new QuestionDraft(q!.Text!, q.Points!.Value,
                q.Options!.Select(o => new OptionDraft(o!.Text!, o.IsCorrect!.Value, o.Id)).ToList(), q.Id)).ToList());
    }
}
