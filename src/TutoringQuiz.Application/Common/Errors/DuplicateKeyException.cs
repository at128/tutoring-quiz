namespace TutoringQuiz.Application.Common.Errors;

/// <summary>
/// A save hit a unique constraint (e.g. a second attempt for the same quiz and student). Thrown by persistence so
/// use cases can react without knowing the database engine.
/// </summary>
public sealed class DuplicateKeyException(Exception innerException)
    : Exception("A row with the same unique key already exists.", innerException);
