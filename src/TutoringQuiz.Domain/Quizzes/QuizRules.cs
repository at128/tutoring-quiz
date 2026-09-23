using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Domain.Quizzes;

/// <summary>
/// Validation limits for quiz content (docs/DOMAIN.md → Validation limits). Error keys follow the API request
/// field names so the same result can be returned to the editor as-is.
/// </summary>
public static class QuizRules
{
    public const int TitleMinLength = 3;
    public const int TitleMaxLength = 200;
    public const int DescriptionMaxLength = 1000;
    public const int MinDurationMinutes = 1;
    public const int MaxDurationMinutes = 180;
    public const int MinPenaltyPercent = 0;
    public const int MaxPenaltyPercent = 100;
    public const int MaxQuestions = 100;
    public const int QuestionTextMaxLength = 2000;
    public const int MinPoints = 1;
    public const int MaxPoints = 100;
    public const int MinOptions = 2;
    public const int MaxOptions = 6;
    public const int OptionTextMaxLength = 500;

    public static Dictionary<string, string[]> Validate(
        QuizDetails details,
        IReadOnlyCollection<Guid> classRoomIds,
        IReadOnlyList<QuestionDraft> questions)
    {
        var errors = new Dictionary<string, List<string>>();
        void Add(string key, string message)
        {
            if (!errors.TryGetValue(key, out var list)) errors[key] = list = [];
            list.Add(message);
        }

        var title = details.Title?.Trim() ?? "";
        if (title.Length is < TitleMinLength or > TitleMaxLength)
            Add("title", $"Title must be {TitleMinLength}–{TitleMaxLength} characters.");
        if ((details.Description?.Trim().Length ?? 0) > DescriptionMaxLength)
            Add("description", $"Description can be at most {DescriptionMaxLength} characters.");
        if (details.DurationMinutes is < MinDurationMinutes or > MaxDurationMinutes)
            Add("durationMinutes", $"Time limit must be {MinDurationMinutes}–{MaxDurationMinutes} minutes.");
        if (details.WrongAnswerPenaltyPercent is < MinPenaltyPercent or > MaxPenaltyPercent)
            Add("wrongAnswerPenaltyPercent", $"Negative marking must be {MinPenaltyPercent}–{MaxPenaltyPercent} %.");
        if (details.ClosesAtUtc <= details.OpensAtUtc)
            Add("closesAt", "Closing time must be after the opening time.");
        if (classRoomIds.Count == 0)
            Add("classRoomIds", "Choose at least one class.");

        if (questions.Count > MaxQuestions)
            Add("questions", $"A quiz can have at most {MaxQuestions} questions.");

        for (var i = 0; i < questions.Count; i++)
        {
            var question = questions[i];
            var prefix = $"questions[{i}]";
            if (question is null)
            {
                Add(prefix, "Question is missing.");
                continue;
            }

            var text = question.Text?.Trim() ?? "";
            if (text.Length is 0 or > QuestionTextMaxLength)
                Add($"{prefix}.text", $"Question text must be 1–{QuestionTextMaxLength} characters.");
            if (question.Points is < MinPoints or > MaxPoints)
                Add($"{prefix}.points", $"Points must be a whole number from {MinPoints} to {MaxPoints}.");

            var options = question.Options ?? [];
            if (options.Count is < MinOptions or > MaxOptions)
                Add($"{prefix}.options", $"A question needs {MinOptions}–{MaxOptions} options.");
            if (options.Count(o => o is not null && o.IsCorrect) != 1)
                Add($"{prefix}.options", "Exactly one option must be correct.");

            for (var j = 0; j < options.Count; j++)
            {
                var optionText = options[j]?.Text?.Trim() ?? "";
                if (optionText.Length is 0 or > OptionTextMaxLength)
                    Add($"{prefix}.options[{j}].text", $"Option text must be 1–{OptionTextMaxLength} characters.");
            }
        }

        return errors.ToDictionary(e => e.Key, e => e.Value.ToArray());
    }

    public static void EnsureValid(
        QuizDetails details,
        IReadOnlyCollection<Guid> classRoomIds,
        IReadOnlyList<QuestionDraft> questions)
    {
        var errors = Validate(details, classRoomIds, questions);
        if (errors.Count > 0)
            throw new DomainException(ErrorCodes.ValidationFailed, "The quiz has invalid fields.", errors);
    }
}
