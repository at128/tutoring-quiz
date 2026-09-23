namespace TutoringQuiz.Domain.Common;

/// <summary>A business rule was violated. <see cref="Code"/> is one of <see cref="ErrorCodes"/>.</summary>
public sealed class DomainException(string code, string message, IReadOnlyDictionary<string, string[]>? errors = null)
    : Exception(message)
{
    public string Code { get; } = code;

    /// <summary>Field-level problems keyed like the API request (e.g. <c>questions[2].options</c>).</summary>
    public IReadOnlyDictionary<string, string[]>? Errors { get; } = errors;
}
