using TutoringQuiz.Application.Common.Errors;

namespace TutoringQuiz.Application.Common.Validation;

public sealed record FieldError(string Field, string Message);

/// <summary>
/// Small pure helpers: a validator is a function from a request to a sequence of <see cref="FieldError"/>s,
/// so rules compose by concatenation and nothing throws until <see cref="ThrowIfAny"/>.
/// </summary>
public static class FieldErrors
{
    public static IEnumerable<FieldError> When(bool failed, string field, string message) =>
        failed ? [new FieldError(field, message)] : [];

    public static IReadOnlyDictionary<string, string[]> ToDictionary(IEnumerable<FieldError> errors) =>
        errors
            .GroupBy(e => e.Field)
            .ToDictionary(g => g.Key, g => g.Select(e => e.Message).Distinct().ToArray());

    public static void ThrowIfAny(IEnumerable<FieldError> errors)
    {
        var grouped = ToDictionary(errors);
        if (grouped.Count > 0) throw new ValidationException(grouped);
    }
}
