using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.ClassRooms;
using TutoringQuiz.Domain.Quizzes;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Infrastructure.Seeding;

/// <summary>
/// Deterministic demo attempts so teacher results aren't empty (docs/SEED_DATA.md). The same files always
/// produce the same answers; only the dates move with the seeding moment. Scores come from the domain.
/// </summary>
internal static class DemoAttemptGenerator
{
    private const int RandomSeedBase = 20260924;
    private const double UnansweredRate = 0.07;
    private static readonly TimeSpan FinishBeforeNow = TimeSpan.FromMinutes(1);

    public static IReadOnlyList<QuizAttempt> Generate(
        Quiz quiz,
        string quizKey,
        DemoAttemptsSeed plan,
        int quizIndex,
        IReadOnlyList<User> students,
        IReadOnlyDictionary<string, ClassRoom> classByName,
        DateTime nowUtc)
    {
        EnsurePlanIsValid(quiz, quizKey, plan, classByName, nowUtc);

        var random = new Random(RandomSeedBase + quizIndex);
        var takers = PickTakers(plan, students, classByName);
        var expired = PickExpired(takers.Count, plan.ExpiredRatio, random);

        return takers.Select((student, index) => Simulate(quiz, student, expired.Contains(index), random, nowUtc)).ToList();
    }

    private static void EnsurePlanIsValid(
        Quiz quiz, string quizKey, DemoAttemptsSeed plan, IReadOnlyDictionary<string, ClassRoom> classByName, DateTime nowUtc)
    {
        SeedDataException Fail(string problem) => new($"quizzes.json, quiz '{quizKey}', demoAttempts: {problem}");

        if (!quiz.IsPublished) throw Fail("only published quizzes can have demo attempts.");
        if (plan.SkipFirstPerClass < 0 || plan.MaxPerClass < 0) throw Fail("skipFirstPerClass and maxPerClass can't be negative.");
        if (plan.ExpiredRatio is < 0 or > 1) throw Fail("expiredRatio must be between 0 and 1.");
        if (LatestStart(quiz, nowUtc) <= quiz.OpensAtUtc) throw Fail("the quiz hasn't been open long enough for a finished attempt.");

        foreach (var name in plan.ClassRooms)
        {
            if (!classByName.TryGetValue(name, out var classRoom)) throw Fail($"unknown class '{name}'.");
            if (!quiz.IsAssignedTo(classRoom.Id)) throw Fail($"class '{name}' is not assigned to this quiz.");
        }
    }

    /// <summary>Per class, ordered by username: skip the reserved reviewer accounts, then take at most N.</summary>
    private static List<User> PickTakers(
        DemoAttemptsSeed plan, IReadOnlyList<User> students, IReadOnlyDictionary<string, ClassRoom> classByName) =>
        plan.ClassRooms
            .Select(name => classByName[name].Id)
            .SelectMany(classId => students
                .Where(s => s.ClassRoomId == classId)
                .OrderBy(s => s.Username, StringComparer.Ordinal)
                .Skip(plan.SkipFirstPerClass)
                .Take(plan.MaxPerClass))
            .ToList();

    private static HashSet<int> PickExpired(int count, double ratio, Random random)
    {
        var expiredCount = (int)Math.Round(count * ratio, MidpointRounding.AwayFromZero);
        return Enumerable.Range(0, count).OrderBy(_ => random.Next()).Take(expiredCount).ToHashSet();
    }

    private static QuizAttempt Simulate(Quiz quiz, User student, bool expires, Random random, DateTime nowUtc)
    {
        var attempt = QuizAttempt.Start(quiz, student.Id, PickStart(quiz, random, nowUtc));
        var finishedAt = expires ? attempt.DeadlineUtc : PickSubmitTime(attempt, random);

        AnswerQuestions(attempt, quiz, Ability(student.Username), finishedAt, random);

        if (expires) attempt.FinalizeIfExpired(quiz, nowUtc); // abandoned: expires at the deadline
        else attempt.Submit(quiz, finishedAt);
        return attempt;
    }

    /// <summary>Somewhere in the quiz window, early enough that the whole attempt is over before now.</summary>
    private static DateTime PickStart(Quiz quiz, Random random, DateTime nowUtc)
    {
        var window = LatestStart(quiz, nowUtc) - quiz.OpensAtUtc;
        return TruncateToSecond(quiz.OpensAtUtc + window * random.NextDouble());
    }

    private static DateTime LatestStart(Quiz quiz, DateTime nowUtc)
    {
        var end = quiz.ClosesAtUtc < nowUtc ? quiz.ClosesAtUtc : nowUtc;
        return end - TimeSpan.FromMinutes(quiz.DurationMinutes) - FinishBeforeNow;
    }

    /// <summary>A few minutes before the deadline (never before the start).</summary>
    private static DateTime PickSubmitTime(QuizAttempt attempt, Random random)
    {
        var submittedAt = attempt.DeadlineUtc - TimeSpan.FromMinutes(random.Next(1, 6));
        return submittedAt > attempt.StartedAtUtc
            ? submittedAt
            : attempt.StartedAtUtc + (attempt.DeadlineUtc - attempt.StartedAtUtc) / 2;
    }

    private static void AnswerQuestions(QuizAttempt attempt, Quiz quiz, double ability, DateTime finishedAt, Random random)
    {
        var step = (finishedAt - attempt.StartedAtUtc) / (quiz.Questions.Count + 1);
        for (var i = 0; i < quiz.Questions.Count; i++)
        {
            var question = quiz.Questions[i];
            if (PickOption(question, ability, random) is { } optionId)
                attempt.SaveAnswer(question, optionId, attempt.StartedAtUtc + step * (i + 1));
        }
    }

    /// <summary>7 % unanswered; otherwise correct with probability <paramref name="ability"/>, else a random wrong option.</summary>
    private static Guid? PickOption(Question question, double ability, Random random)
    {
        if (random.NextDouble() < UnansweredRate) return null;
        if (random.NextDouble() < ability) return question.CorrectOptionId;

        var wrong = question.Options.Where(o => !o.IsCorrect).ToList();
        return wrong[random.Next(wrong.Count)].Id;
    }

    /// <summary>0.45–0.94 from a hash that is stable across processes (unlike <c>string.GetHashCode</c>).</summary>
    private static double Ability(string username) => 0.45 + username.Sum(c => (int)c) % 50 / 100.0;

    private static DateTime TruncateToSecond(DateTime value) =>
        new(value.Ticks - value.Ticks % TimeSpan.TicksPerSecond, DateTimeKind.Utc);
}
