namespace TutoringQuiz.Infrastructure.Seeding;

/// <summary>Seed files are invalid. The message names the file and line (or quiz) so the data can be fixed.</summary>
public sealed class SeedDataException(string message, Exception? innerException = null)
    : Exception(message, innerException)
{
    public static SeedDataException At(string file, long line, string problem) =>
        new($"{file}, line {line}: {problem}");
}
