using System.Text.Json;

namespace TutoringQuiz.Infrastructure.Seeding;

internal sealed record ClassRoomRow(string File, long Line, string Name, int Grade);

internal sealed record PersonRow(string File, long Line, string Username, string FullName, string? ClassName);

internal sealed record QuizzesFile(IReadOnlyList<QuizSeed> Quizzes);

internal sealed record QuizSeed(
    string Key,
    string Title,
    string Teacher,
    IReadOnlyList<string> ClassRooms,
    double OpensInHours,
    double ClosesInHours,
    int DurationMinutes,
    int WrongAnswerPenaltyPercent,
    bool IsPublished,
    IReadOnlyList<QuestionSeed> Questions,
    string? Description = null,
    DemoAttemptsSeed? DemoAttempts = null);

internal sealed record QuestionSeed(string Text, int Points, IReadOnlyList<OptionSeed> Options);

internal sealed record OptionSeed(string Text, bool IsCorrect);

internal sealed record DemoAttemptsSeed(IReadOnlyList<string> ClassRooms, int SkipFirstPerClass, int MaxPerClass, double ExpiredRatio);

/// <summary>Everything in the <c>seed/</c> folder, parsed but not yet turned into entities.</summary>
internal sealed record SeedFiles(
    IReadOnlyList<ClassRoomRow> ClassRooms,
    IReadOnlyList<PersonRow> Teachers,
    IReadOnlyList<PersonRow> Students,
    IReadOnlyList<QuizSeed> Quizzes)
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        RespectNullableAnnotations = true,
        RespectRequiredConstructorParameters = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
    };

    public static SeedFiles Read(string folder) => new(
        CsvFile.Read(Path.Combine(folder, "classrooms.csv"), "name", "grade")
            .Select(r => new ClassRoomRow(r.File, r.Line, r.Text("name"), r.Number("grade")))
            .ToList(),
        CsvFile.Read(Path.Combine(folder, "teachers.csv"), "username", "full_name", "subject")
            .Select(r => new PersonRow(r.File, r.Line, r.Text("username"), r.Text("full_name"), ClassName: null))
            .ToList(),
        CsvFile.Read(Path.Combine(folder, "students.csv"), "username", "full_name", "class")
            .Select(r => new PersonRow(r.File, r.Line, r.Text("username"), r.Text("full_name"), r.Text("class")))
            .ToList(),
        ReadQuizzes(Path.Combine(folder, "quizzes.json")));

    private static IReadOnlyList<QuizSeed> ReadQuizzes(string path)
    {
        if (!File.Exists(path)) throw new SeedDataException($"quizzes.json: file not found at '{path}'.");
        try
        {
            using var stream = File.OpenRead(path);
            return JsonSerializer.Deserialize<QuizzesFile>(stream, JsonOptions)?.Quizzes
                ?? throw new SeedDataException("quizzes.json: the file is empty.");
        }
        catch (JsonException ex)
        {
            throw new SeedDataException(
                $"quizzes.json, line {(ex.LineNumber ?? 0) + 1} ({ex.Path}): {ex.Message}", ex);
        }
    }
}
