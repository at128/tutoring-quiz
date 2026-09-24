using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;

namespace TutoringQuiz.Api.IntegrationTests;

public sealed class ScoreVisibilityTests(TestAppFactory factory) : IClassFixture<TestAppFactory>
{
    [Fact]
    public async Task HiddenScore_IsNullInEveryStudentResponse_ButTeacherSeesIt_AndLiveToggleRestoresIt()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        var quizId = data.Quiz.Id;
        var attempt = await RegradeHttp.StartAsync(student, quizId);
        await RegradeHttp.AnswerAsync(student, attempt, 0, 0);
        var path = $"/api/teacher/quizzes/{quizId}/score-visibility";
        using (var hidden = await teacher.PutAsJsonAsync(path, new { scoresVisibleToStudents = false }))
        {
            Assert.Equal(HttpStatusCode.OK, hidden.StatusCode);
            Assert.False((await RegradeHttp.JsonAsync(hidden)).GetProperty("scoresVisibleToStudents").GetBoolean());
        }
        var submit = await RegradeHttp.SubmitAsync(student, attempt);
        AssertHidden(submit);
        using (var response = await student.GetAsync($"/api/student/attempts/{attempt.GetProperty("id").GetGuid()}/result"))
        {
            var raw = await response.Content.ReadAsStringAsync();
            Assert.DoesNotContain("\"score\":4", raw, StringComparison.OrdinalIgnoreCase);
            AssertHidden(JsonDocument.Parse(raw).RootElement);
        }
        using (var view = await student.GetAsync($"/api/student/attempts/{attempt.GetProperty("id").GetGuid()}"))
            AssertHidden((await RegradeHttp.JsonAsync(view)).GetProperty("result"));
        using (var list = await student.GetAsync("/api/student/quizzes"))
        {
            var card = (await RegradeHttp.JsonAsync(list)).GetProperty("quizzes").EnumerateArray()
                .Single(q => q.GetProperty("id").GetGuid() == quizId);
            Assert.False(card.GetProperty("attempt").GetProperty("scoreVisible").GetBoolean());
            Assert.Equal(JsonValueKind.Null, card.GetProperty("attempt").GetProperty("score").ValueKind);
        }
        using (var results = await teacher.GetAsync($"/api/teacher/quizzes/{quizId}/results"))
        {
            var body = await RegradeHttp.JsonAsync(results);
            Assert.False(body.GetProperty("quiz").GetProperty("scoresVisibleToStudents").GetBoolean());
            var row = body.GetProperty("rows").EnumerateArray().Single(r => r.GetProperty("studentId").GetGuid() == data.Student.Id);
            Assert.Equal(4m, row.GetProperty("score").GetDecimal());
            Assert.True(row.TryGetProperty("regradedAt", out _));
        }
        using (var detail = await teacher.GetAsync($"/api/teacher/quizzes/{quizId}/attempts/{attempt.GetProperty("id").GetGuid()}"))
            Assert.Equal(4m, (await RegradeHttp.JsonAsync(detail)).GetProperty("score").GetDecimal());

        using (var shown = await teacher.PutAsJsonAsync(path, new { scoresVisibleToStudents = true }))
            Assert.True((await RegradeHttp.JsonAsync(shown)).GetProperty("scoresVisibleToStudents").GetBoolean());
        var revealed = await RegradeHttp.ResultAsync(student, attempt);
        Assert.True(revealed.GetProperty("scoreVisible").GetBoolean());
        Assert.Equal(4m, revealed.GetProperty("score").GetDecimal());
        Assert.Equal(9, revealed.GetProperty("maxScore").GetInt32());
        Assert.Equal(44.4m, revealed.GetProperty("percentage").GetDecimal());
        using (var list = await student.GetAsync("/api/student/quizzes"))
        {
            var card = (await RegradeHttp.JsonAsync(list)).GetProperty("quizzes").EnumerateArray()
                .Single(q => q.GetProperty("id").GetGuid() == quizId);
            Assert.True(card.GetProperty("attempt").GetProperty("scoreVisible").GetBoolean());
            Assert.Equal(4m, card.GetProperty("attempt").GetProperty("score").GetDecimal());
        }
    }

    [Fact]
    public async Task VisibilityEndpoint_WorksWhileOpenWithAttempts_RequiresBool_AndDefaultIsVisible()
    {
        var data = await TestData.CreateAsync(factory);
        var other = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var outsider = await TestData.LoginAsync(factory, other.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        var path = $"/api/teacher/quizzes/{data.Quiz.Id}";
        var initial = await RegradeHttp.EditorAsync(teacher, data.Quiz.Id);
        Assert.True(initial.GetProperty("scoresVisibleToStudents").GetBoolean()); // old quizzes without request field
        var attempt = await RegradeHttp.StartAsync(student, data.Quiz.Id);
        using (var invalid = await teacher.PutAsJsonAsync(path + "/score-visibility", new { }))
        {
            Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
            Assert.Equal("validation_failed", (await RegradeHttp.JsonAsync(invalid)).GetProperty("code").GetString());
        }
        using (var outsiderResponse = await outsider.PutAsJsonAsync(path + "/score-visibility", new { scoresVisibleToStudents = false }))
            Assert.Equal(HttpStatusCode.NotFound, outsiderResponse.StatusCode);
        using (var hidden = await teacher.PutAsJsonAsync(path + "/score-visibility", new { scoresVisibleToStudents = false }))
        {
            Assert.Equal(HttpStatusCode.OK, hidden.StatusCode);
            var view = await RegradeHttp.JsonAsync(hidden);
            Assert.True(view.GetProperty("isLocked").GetBoolean());
            Assert.True(view.GetProperty("hasAttempts").GetBoolean());
            Assert.False(view.GetProperty("scoresVisibleToStudents").GetBoolean());
        }
        AssertHidden(await RegradeHttp.SubmitAsync(student, attempt));
        var again = await RegradeHttp.EditorAsync(teacher, data.Quiz.Id);
        Assert.False(again.GetProperty("scoresVisibleToStudents").GetBoolean());
    }

    private static void AssertHidden(JsonElement result)
    {
        Assert.False(result.GetProperty("scoreVisible").GetBoolean());
        foreach (var name in new[] { "score", "maxScore", "percentage", "correctCount", "wrongCount", "unansweredCount", "regradedAt" })
        {
            Assert.True(result.TryGetProperty(name, out var value), $"Missing {name}");
            Assert.Equal(JsonValueKind.Null, value.ValueKind);
        }
    }
}
