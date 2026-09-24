using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;

namespace TutoringQuiz.Api.IntegrationTests;

/// <summary>
/// A teacher can make a wrong answer cost a fixed number of points instead of a percentage. It never costs more than
/// the question is worth, and the total still never goes below 0.
/// </summary>
public sealed class FixedDeductionTests(TestAppFactory factory) : IClassFixture<TestAppFactory>
{
    [Fact]
    public async Task HalfAPointPerWrongAnswer_ScoresFromTheSavedAnswers_AndEveryViewShowsTheRule()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        var quizId = await CreatePublishedAsync(teacher, Quiz(data.ClassRoom.Id, points: 0.5m, [2, 1, 1]));

        using (var list = await student.GetAsync("/api/student/quizzes"))
        {
            var item = (await JsonAsync(list)).GetProperty("quizzes").EnumerateArray()
                .Single(q => q.GetProperty("id").GetGuid() == quizId);
            Assert.Equal(0.5m, item.GetProperty("wrongAnswerPenaltyPoints").GetDecimal());
            Assert.Equal(0, item.GetProperty("wrongAnswerPenaltyPercent").GetInt32());
        }

        // correct on 2 points, wrong on 1 point, third unanswered: 2 − 0.5
        var result = await TakeAsync(student, quizId, correct: [0], wrong: [1]);
        Assert.Equal(1.5m, result.GetProperty("score").GetDecimal());
        Assert.Equal(0.5m, result.GetProperty("wrongAnswerPenaltyPoints").GetDecimal());

        using var editor = await teacher.GetAsync($"/api/teacher/quizzes/{quizId}");
        Assert.Equal(0.5m, (await JsonAsync(editor)).GetProperty("wrongAnswerPenaltyPoints").GetDecimal());
        using var results = await teacher.GetAsync($"/api/teacher/quizzes/{quizId}/results");
        var body = await JsonAsync(results);
        Assert.Equal(0.5m, body.GetProperty("quiz").GetProperty("wrongAnswerPenaltyPoints").GetDecimal());
        Assert.Equal(1.5m, body.GetProperty("summary").GetProperty("averageScore").GetDecimal());
    }

    [Fact]
    public async Task AFixedDeductionLargerThanAQuestion_TakesOnlyThatQuestionsPoints()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        var quizId = await CreatePublishedAsync(teacher, Quiz(data.ClassRoom.Id, points: 1.5m, [4, 1]));

        // correct on 4, wrong on 1 point: 1.5 is capped at 1 → 3
        var result = await TakeAsync(student, quizId, correct: [0], wrong: [1]);

        Assert.Equal(3m, result.GetProperty("score").GetDecimal());
    }

    [Theory]
    [InlineData(25, 0.5, "wrongAnswerPenaltyPercent")] // both at once
    [InlineData(0, 0, "wrongAnswerPenaltyPoints")]
    [InlineData(0, -1, "wrongAnswerPenaltyPoints")]
    [InlineData(0, 0.333, "wrongAnswerPenaltyPoints")]
    [InlineData(0, 100.5, "wrongAnswerPenaltyPoints")]
    public async Task AnInvalidDeduction_IsRejectedOnItsField(int percent, double points, string field)
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);

        using var response = await teacher.PostAsJsonAsync("/api/teacher/quizzes",
            Quiz(data.ClassRoom.Id, (decimal)points, [2]) with { WrongAnswerPenaltyPercent = percent });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var body = await JsonAsync(response);
        Assert.Equal("validation_failed", body.GetProperty("code").GetString());
        Assert.True(body.GetProperty("errors").TryGetProperty(field, out _), field);
    }

    [Fact]
    public async Task ADraftCanSwitchFromFixedPointsBackToAPercentage()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var created = await teacher.PostAsJsonAsync("/api/teacher/quizzes", Quiz(data.ClassRoom.Id, 0.5m, [2]));
        var id = (await JsonAsync(created)).GetProperty("id").GetGuid();

        using var updated = await teacher.PutAsJsonAsync($"/api/teacher/quizzes/{id}",
            Quiz(data.ClassRoom.Id, null, [2]) with { WrongAnswerPenaltyPercent = 25 });

        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        var view = await JsonAsync(updated);
        Assert.Equal(25, view.GetProperty("wrongAnswerPenaltyPercent").GetInt32());
        Assert.Equal(JsonValueKind.Null, view.GetProperty("wrongAnswerPenaltyPoints").ValueKind);
    }

    private QuizPayload Quiz(Guid classId, decimal? points, int[] questionPoints)
    {
        var now = factory.Clock.GetUtcNow().UtcDateTime;
        return new QuizPayload("Fixed deduction quiz", null, [classId], now.AddMinutes(-5), now.AddHours(1), 20, 0,
            questionPoints.Select((p, i) => new QuestionPayload($"Question {i + 1}", p,
                [new OptionPayload("Right", true), new OptionPayload("Wrong", false)])).ToArray(), points);
    }

    private static async Task<Guid> CreatePublishedAsync(HttpClient teacher, QuizPayload quiz)
    {
        using var created = await teacher.PostAsJsonAsync("/api/teacher/quizzes", quiz);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await JsonAsync(created)).GetProperty("id").GetGuid();
        using var published = await teacher.PostAsync($"/api/teacher/quizzes/{id}/publish", null);
        Assert.Equal(HttpStatusCode.OK, published.StatusCode);
        return id;
    }

    /// <summary>Answers the given question indexes right or wrong (options are listed right, then wrong), then submits.</summary>
    private static async Task<JsonElement> TakeAsync(HttpClient student, Guid quizId, int[] correct, int[] wrong)
    {
        using var started = await student.PostAsync($"/api/student/quizzes/{quizId}/attempt", null);
        var attempt = await JsonAsync(started);
        var attemptId = attempt.GetProperty("id").GetGuid();
        var questions = attempt.GetProperty("questions");
        foreach (var (index, option) in correct.Select(i => (i, 0)).Concat(wrong.Select(i => (i, 1))))
        {
            var question = questions[index];
            using var saved = await student.PutAsJsonAsync(
                $"/api/student/attempts/{attemptId}/answers/{question.GetProperty("id").GetGuid()}",
                new { selectedOptionId = question.GetProperty("options")[option].GetProperty("id").GetGuid() });
            Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        }

        using var submitted = await student.PostAsync($"/api/student/attempts/{attemptId}/submit", null);
        Assert.Equal(HttpStatusCode.OK, submitted.StatusCode);
        return await JsonAsync(submitted);
    }

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();

    private sealed record QuizPayload(string Title, string? Description, Guid[] ClassRoomIds,
        DateTime OpensAt, DateTime ClosesAt, int DurationMinutes, int WrongAnswerPenaltyPercent,
        QuestionPayload[] Questions, decimal? WrongAnswerPenaltyPoints);

    private sealed record QuestionPayload(string Text, int Points, OptionPayload[] Options);

    private sealed record OptionPayload(string Text, bool IsCorrect);
}
