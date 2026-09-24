using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.ClassRooms;
using TutoringQuiz.Domain.Common;
using TutoringQuiz.Domain.Quizzes;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Infrastructure.Seeding;

/// <summary>The entities to insert, built entirely through domain methods so seed data obeys the same rules.</summary>
internal sealed record SeedGraph(
    IReadOnlyList<ClassRoom> ClassRooms,
    IReadOnlyList<User> Teachers,
    IReadOnlyList<User> Students,
    IReadOnlyList<Quiz> Quizzes,
    IReadOnlyList<QuizAttempt> Attempts);

/// <summary>Turns parsed seed files into entities. Any bad value fails fast, naming the file and line or quiz.</summary>
internal static class SeedGraphBuilder
{
    private const string QuizzesFile = "quizzes.json";

    public static SeedGraph Build(SeedFiles files, SeedOptions options, IPasswordHasher hasher, DateTime nowUtc)
    {
        var classRooms = BuildClassRooms(files.ClassRooms);
        var classByName = classRooms.ToDictionary(c => c.Name, StringComparer.OrdinalIgnoreCase);

        EnsureUniqueUsernames(files.Teachers.Concat(files.Students));
        var teachers = BuildPeople(files.Teachers, options.TeacherPassword, hasher,
            (row, hash) => User.CreateTeacher(row.Username, row.FullName, hash));
        var students = BuildPeople(files.Students, options.StudentPassword, hasher,
            (row, hash) => User.CreateStudent(row.Username, row.FullName, ClassIdOf(row, classByName), hash));

        EnsureUniqueQuizKeys(files.Quizzes);
        var teacherByUsername = teachers.ToDictionary(t => t.UsernameNormalized);
        var quizzes = files.Quizzes.Select(seed => BuildQuiz(seed, teacherByUsername, classByName, nowUtc)).ToList();

        var attempts = files.Quizzes
            .Select((seed, index) => seed.DemoAttempts is null
                ? []
                : DemoAttemptGenerator.Generate(quizzes[index], seed.Key, seed.DemoAttempts, index, students, classByName, nowUtc))
            .SelectMany(generated => generated)
            .ToList();

        return new SeedGraph(classRooms, teachers, students, quizzes, attempts);
    }

    private static List<ClassRoom> BuildClassRooms(IReadOnlyList<ClassRoomRow> rows)
    {
        var duplicate = rows
            .GroupBy(r => r.Name, StringComparer.OrdinalIgnoreCase)
            .FirstOrDefault(g => g.Count() > 1);
        if (duplicate is not null)
        {
            var second = duplicate.Skip(1).First();
            throw SeedDataException.At(second.File, second.Line, $"class '{second.Name}' is listed twice.");
        }

        return rows.Select(row => Guarded(row.File, row.Line, () => new ClassRoom(row.Name, row.Grade))).ToList();
    }

    private static void EnsureUniqueUsernames(IEnumerable<PersonRow> people)
    {
        var duplicate = people
            .GroupBy(p => User.Normalize(p.Username))
            .FirstOrDefault(g => g.Count() > 1);
        if (duplicate is null) return;

        var first = duplicate.First();
        var second = duplicate.Skip(1).First();
        throw SeedDataException.At(second.File, second.Line,
            $"username '{second.Username}' is already used ({first.File}, line {first.Line}).");
    }

    /// <summary>Hashing is the slow part (PBKDF2), so it runs in parallel; entity creation stays in file order.</summary>
    private static List<User> BuildPeople(
        IReadOnlyList<PersonRow> rows,
        string password,
        IPasswordHasher hasher,
        Func<PersonRow, string, User> create)
    {
        var hashes = rows.AsParallel().AsOrdered().Select(_ => hasher.Hash(password)).ToList();
        return rows.Zip(hashes, (row, hash) => Guarded(row.File, row.Line, () => create(row, hash))).ToList();
    }

    private static Guid ClassIdOf(PersonRow row, IReadOnlyDictionary<string, ClassRoom> classByName) =>
        classByName.TryGetValue(row.ClassName ?? "", out var classRoom)
            ? classRoom.Id
            : throw SeedDataException.At(row.File, row.Line,
                $"unknown class '{row.ClassName}' (known: {string.Join(", ", classByName.Keys)}).");

    private static void EnsureUniqueQuizKeys(IReadOnlyList<QuizSeed> quizzes)
    {
        var duplicate = quizzes.GroupBy(q => q.Key, StringComparer.OrdinalIgnoreCase).FirstOrDefault(g => g.Count() > 1);
        if (duplicate is not null)
            throw new SeedDataException($"{QuizzesFile}: quiz key '{duplicate.Key}' is used more than once.");
    }

    private static Quiz BuildQuiz(
        QuizSeed seed,
        IReadOnlyDictionary<string, User> teacherByUsername,
        IReadOnlyDictionary<string, ClassRoom> classByName,
        DateTime nowUtc)
    {
        SeedDataException Fail(string problem) => new($"{QuizzesFile}, quiz '{seed.Key}': {problem}");

        var teacher = teacherByUsername.GetValueOrDefault(User.Normalize(seed.Teacher))
            ?? throw Fail($"unknown teacher '{seed.Teacher}'.");
        var classRoomIds = seed.ClassRooms
            .Select(name => classByName.TryGetValue(name, out var c) ? c.Id : throw Fail($"unknown class '{name}'."))
            .ToList();

        var details = new QuizDetails(
            seed.Title,
            seed.Description,
            nowUtc.AddHours(seed.OpensInHours),
            nowUtc.AddHours(seed.ClosesInHours),
            seed.DurationMinutes,
            seed.WrongAnswerPenaltyPercent,
            seed.WrongAnswerPenaltyPoints);
        var questions = seed.Questions
            .Select(q => new QuestionDraft(q.Text, q.Points, q.Options.Select(o => new OptionDraft(o.Text, o.IsCorrect)).ToList()))
            .ToList();

        var errors = QuizRules.Validate(details, classRoomIds, questions);
        if (errors.Count > 0)
            throw Fail(string.Join("; ", errors.Select(e => $"{e.Key}: {string.Join(" ", e.Value)}")));

        // The teacher wrote and published it two days before it opened (or now, if that's still ahead).
        var createdAt = Earlier(nowUtc, details.OpensAtUtc.AddDays(-2));
        try
        {
            var quiz = Quiz.Create(teacher.Id, details, classRoomIds, questions, createdAt);
            if (seed.IsPublished) quiz.Publish(createdAt);
            return quiz;
        }
        catch (DomainException ex)
        {
            throw Fail(ex.Message);
        }
    }

    private static T Guarded<T>(string file, long line, Func<T> create)
    {
        try
        {
            return create();
        }
        catch (DomainException ex)
        {
            throw SeedDataException.At(file, line, ex.Message);
        }
    }

    private static DateTime Earlier(DateTime a, DateTime b) => a < b ? a : b;
}
