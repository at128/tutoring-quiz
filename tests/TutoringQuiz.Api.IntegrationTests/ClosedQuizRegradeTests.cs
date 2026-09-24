using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;
using TutoringQuiz.Domain.Quizzes;
using TutoringQuiz.Infrastructure.Persistence;

namespace TutoringQuiz.Api.IntegrationTests;

public sealed class ClosedQuizRegradeTests(TestAppFactory factory) : IClassFixture<TestAppFactory>
{
    [Fact]
    public async Task ClosedCorrection_RegradesEverySubmittedAttempt_WithoutChangingAnswersOrTimes()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var first = await TestData.LoginAsync(factory, data.Student);
        using var second = await TestData.LoginAsync(factory, data.SecondStudent);
        var firstAttempt = await RegradeHttp.StartAsync(first, data.Quiz.Id);
        var secondAttempt = await RegradeHttp.StartAsync(second, data.Quiz.Id);
        await RegradeHttp.AnswerAsync(first, firstAttempt, 0, 0);
        await RegradeHttp.AnswerAsync(first, firstAttempt, 1, 1);
        await RegradeHttp.AnswerAsync(second, secondAttempt, 0, 1);
        await RegradeHttp.AnswerAsync(second, secondAttempt, 1, 0);
        var firstBefore = await RegradeHttp.SubmitAsync(first, firstAttempt);
        var secondBefore = await RegradeHttp.SubmitAsync(second, secondAttempt);
        Assert.Equal(3.5m, firstBefore.GetProperty("score").GetDecimal());
        Assert.Equal(1m, secondBefore.GetProperty("score").GetDecimal());

        var path = $"/api/teacher/quizzes/{data.Quiz.Id}";
        var draft = await RegradeHttp.EditorAsync(teacher, data.Quiz.Id);
        Assert.True(draft.GetProperty("hasAttempts").GetBoolean());
        Assert.True(draft.GetProperty("isLocked").GetBoolean());
        using (var locked = await teacher.PutAsJsonAsync(path, RegradeHttp.Payload(draft)))
        {
            Assert.Equal(HttpStatusCode.Conflict, locked.StatusCode);
            Assert.Equal("quiz.locked", (await RegradeHttp.JsonAsync(locked)).GetProperty("code").GetString());
        }

        factory.Clock.Advance(TimeSpan.FromHours(1) + TimeSpan.FromSeconds(1));
        var edit = RegradeHttp.Payload(await RegradeHttp.EditorAsync(teacher, data.Quiz.Id));
        edit["title"] = "Corrected after close";
        edit["wrongAnswerPenaltyPercent"] = 50;
        var questions = edit["questions"]!.AsArray();
        questions[0]!["points"] = 6;
        var options = questions[0]!["options"]!.AsArray();
        options[0]!["isCorrect"] = false;
        options[1]!["isCorrect"] = true;
        using var changed = await teacher.PutAsJsonAsync(path, edit);
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        var changedView = await RegradeHttp.JsonAsync(changed);
        Assert.False(changedView.GetProperty("isLocked").GetBoolean());
        Assert.Equal("Corrected after close", changedView.GetProperty("title").GetString());
        Assert.Equal(11, changedView.GetProperty("maxScore").GetInt32());
        Assert.Equal(firstAttempt.GetProperty("questions")[0].GetProperty("id").GetGuid(),
            changedView.GetProperty("questions")[0].GetProperty("id").GetGuid());

        var firstAfter = await RegradeHttp.ResultAsync(first, firstAttempt);
        var secondAfter = await RegradeHttp.ResultAsync(second, secondAttempt);
        Assert.Equal("Submitted", firstAfter.GetProperty("status").GetString());
        Assert.Equal("Submitted", secondAfter.GetProperty("status").GetString());
        Assert.Equal(0m, firstAfter.GetProperty("score").GetDecimal()); // -3 -1 is floored
        Assert.Equal(8m, secondAfter.GetProperty("score").GetDecimal()); // 6 + 2
        Assert.Equal(11, secondAfter.GetProperty("maxScore").GetInt32());
        Assert.Equal(72.7m, secondAfter.GetProperty("percentage").GetDecimal());
        Assert.Equal(2, firstAfter.GetProperty("wrongCount").GetInt32());
        Assert.Equal(2, secondAfter.GetProperty("correctCount").GetInt32());
        Assert.NotEqual(JsonValueKind.Null, firstAfter.GetProperty("regradedAt").ValueKind);
        Assert.Equal(firstBefore.GetProperty("finalizedAt").GetString(), firstAfter.GetProperty("finalizedAt").GetString());
        Assert.Equal(secondBefore.GetProperty("startedAt").GetString(), secondAfter.GetProperty("startedAt").GetString());
        var firstDetail = await RegradeHttp.DetailAsync(teacher, data.Quiz.Id, firstAttempt);
        Assert.Equal(firstAttempt.GetProperty("questions")[0].GetProperty("options")[0].GetProperty("id").GetGuid(),
            firstDetail.GetProperty("questions")[0].GetProperty("selectedOptionId").GetGuid());

        using var repeated = await teacher.PutAsJsonAsync(path, RegradeHttp.Payload(changedView));
        Assert.Equal(HttpStatusCode.OK, repeated.StatusCode);
        var unchanged = await RegradeHttp.ResultAsync(second, secondAttempt);
        Assert.Equal(secondAfter.GetProperty("regradedAt").GetString(), unchanged.GetProperty("regradedAt").GetString());
    }

    [Fact]
    public async Task RemovingAnsweredQuestionAndChosenOption_PreservesHistory_AndNewQuestionIsUnanswered()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        var attempt = await RegradeHttp.StartAsync(student, data.Quiz.Id);
        await RegradeHttp.AnswerAsync(student, attempt, 0, 0);
        await RegradeHttp.AnswerAsync(student, attempt, 1, 1);
        await RegradeHttp.SubmitAsync(student, attempt);
        var removedQuestionId = attempt.GetProperty("questions")[1].GetProperty("id").GetGuid();
        var removedOptionId = attempt.GetProperty("questions")[0].GetProperty("options")[0].GetProperty("id").GetGuid();
        factory.Clock.Advance(TimeSpan.FromHours(1) + TimeSpan.FromSeconds(1));

        var edit = RegradeHttp.Payload(await RegradeHttp.EditorAsync(teacher, data.Quiz.Id));
        var questions = edit["questions"]!.AsArray();
        questions.RemoveAt(1);
        var options = questions[0]!["options"]!.AsArray();
        options.RemoveAt(0);
        options[0]!["isCorrect"] = true;
        questions.Add(new JsonObject
        {
            ["text"] = "A new question", ["points"] = 3,
            ["options"] = new JsonArray(
                new JsonObject { ["text"] = "Yes", ["isCorrect"] = true },
                new JsonObject { ["text"] = "No", ["isCorrect"] = false })
        });
        using var changed = await teacher.PutAsJsonAsync($"/api/teacher/quizzes/{data.Quiz.Id}", edit);
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        var result = await RegradeHttp.ResultAsync(student, attempt);
        Assert.Equal(0m, result.GetProperty("score").GetDecimal());
        Assert.Equal(10, result.GetProperty("maxScore").GetInt32());
        Assert.Equal(0, result.GetProperty("correctCount").GetInt32());
        Assert.Equal(0, result.GetProperty("wrongCount").GetInt32());
        Assert.Equal(4, result.GetProperty("unansweredCount").GetInt32());
        var detail = await RegradeHttp.DetailAsync(teacher, data.Quiz.Id, attempt);
        Assert.DoesNotContain(detail.GetProperty("questions").EnumerateArray(), q => q.GetProperty("questionId").GetGuid() == removedQuestionId);
        var line = detail.GetProperty("questions")[0];
        Assert.Equal(removedOptionId, line.GetProperty("selectedOptionId").GetGuid());
        Assert.Equal("Correct", line.GetProperty("removedSelectionText").GetString());
        Assert.Equal("Unanswered", line.GetProperty("outcome").GetString());
        Assert.Equal(0m, line.GetProperty("deduction").GetDecimal());
        Assert.Equal("Unanswered", detail.GetProperty("questions")[3].GetProperty("outcome").GetString());
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var removed = await db.Set<Question>().IgnoreQueryFilters().SingleAsync(q => q.Id == removedQuestionId);
        var option = await db.Set<Option>().IgnoreQueryFilters().SingleAsync(o => o.Id == removedOptionId);
        Assert.NotNull(removed.RemovedAtUtc);
        Assert.NotNull(option.RemovedAtUtc);
    }

    [Fact]
    public async Task InvalidOrScheduleChangingEdit_IsAtomic_AndOtherTeacherCannotEdit()
    {
        var data = await TestData.CreateAsync(factory);
        var outsiderData = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var outsider = await TestData.LoginAsync(factory, outsiderData.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        var attempt = await RegradeHttp.StartAsync(student, data.Quiz.Id);
        await RegradeHttp.AnswerAsync(student, attempt, 0, 0);
        await RegradeHttp.SubmitAsync(student, attempt);
        factory.Clock.Advance(TimeSpan.FromHours(1) + TimeSpan.FromSeconds(1));
        var beforeEditor = await RegradeHttp.EditorAsync(teacher, data.Quiz.Id);
        var beforeResult = await RegradeHttp.ResultAsync(student, attempt);
        var path = $"/api/teacher/quizzes/{data.Quiz.Id}";

        var bad = RegradeHttp.Payload(beforeEditor);
        bad["title"] = "Wrongly applied";
        bad["questions"]![0]!["points"] = 7;
        bad["questions"]![0]!["text"] = "";
        using (var rejected = await teacher.PutAsJsonAsync(path, bad))
            Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        foreach (var field in new[] { "opensAt", "closesAt", "durationMinutes", "classRoomIds" })
        {
            var altered = RegradeHttp.Payload(beforeEditor);
            if (field == "durationMinutes") altered[field] = 19;
            else if (field == "classRoomIds") altered[field] = new JsonArray(JsonValue.Create(outsiderData.ClassRoom.Id));
            else altered[field] = beforeEditor.GetProperty(field).GetDateTime().AddSeconds(1);
            using var rejected = await teacher.PutAsJsonAsync(path, altered);
            Assert.Equal(HttpStatusCode.Conflict, rejected.StatusCode);
            Assert.Equal("quiz.locked", (await RegradeHttp.JsonAsync(rejected)).GetProperty("code").GetString());
        }
        using (var forbidden = await outsider.PutAsJsonAsync(path, RegradeHttp.Payload(beforeEditor)))
        {
            Assert.Equal(HttpStatusCode.NotFound, forbidden.StatusCode);
            Assert.Equal("not_found", (await RegradeHttp.JsonAsync(forbidden)).GetProperty("code").GetString());
        }
        Assert.Equal(beforeEditor.GetRawText(), (await RegradeHttp.EditorAsync(teacher, data.Quiz.Id)).GetRawText());
        Assert.Equal(beforeResult.GetRawText(), (await RegradeHttp.ResultAsync(student, attempt)).GetRawText());
    }

    [Fact]
    public async Task ExpiredAttempt_RegradesOnClosedEdit_AndFixedPenaltyIsCapped()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        var attempt = await RegradeHttp.StartAsync(student, data.Quiz.Id);
        await RegradeHttp.AnswerAsync(student, attempt, 0, 0);
        await RegradeHttp.AnswerAsync(student, attempt, 1, 1);
        var deadline = attempt.GetProperty("deadline").GetString();
        factory.Clock.Advance(TimeSpan.FromHours(1) + TimeSpan.FromSeconds(1));
        var edit = RegradeHttp.Payload(await RegradeHttp.EditorAsync(teacher, data.Quiz.Id));
        edit["wrongAnswerPenaltyPercent"] = 0;
        edit["wrongAnswerPenaltyPoints"] = 5m;
        edit["questions"]![0]!["points"] = 6;
        using var changed = await teacher.PutAsJsonAsync($"/api/teacher/quizzes/{data.Quiz.Id}", edit);
        Assert.Equal(HttpStatusCode.OK, changed.StatusCode);
        var result = await RegradeHttp.ResultAsync(student, attempt);
        Assert.Equal("Expired", result.GetProperty("status").GetString());
        Assert.Equal(deadline, result.GetProperty("finalizedAt").GetString());
        Assert.Equal(4m, result.GetProperty("score").GetDecimal()); // 6 - min(5, 2)
        Assert.Equal(11, result.GetProperty("maxScore").GetInt32());
        Assert.Equal(1, result.GetProperty("correctCount").GetInt32());
        Assert.Equal(1, result.GetProperty("wrongCount").GetInt32());
    }
}

internal static class RegradeHttp
{
    public static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        JsonDocument.Parse(await response.Content.ReadAsStringAsync()).RootElement.Clone();

    public static async Task<JsonElement> EditorAsync(HttpClient teacher, Guid quizId)
    {
        using var response = await teacher.GetAsync($"/api/teacher/quizzes/{quizId}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await JsonAsync(response);
    }

    public static JsonObject Payload(JsonElement view) => new()
    {
        ["title"] = view.GetProperty("title").GetString(),
        ["description"] = view.GetProperty("description").ValueKind == JsonValueKind.Null ? null : view.GetProperty("description").GetString(),
        ["classRoomIds"] = new JsonArray(view.GetProperty("classRooms").EnumerateArray().Select(c => (JsonNode?)JsonValue.Create(c.GetProperty("id").GetGuid())).ToArray()),
        ["opensAt"] = view.GetProperty("opensAt").GetString(),
        ["closesAt"] = view.GetProperty("closesAt").GetString(),
        ["durationMinutes"] = view.GetProperty("durationMinutes").GetInt32(),
        ["wrongAnswerPenaltyPercent"] = view.GetProperty("wrongAnswerPenaltyPercent").GetInt32(),
        ["wrongAnswerPenaltyPoints"] = view.GetProperty("wrongAnswerPenaltyPoints").ValueKind == JsonValueKind.Null ? null : view.GetProperty("wrongAnswerPenaltyPoints").GetDecimal(),
        ["scoresVisibleToStudents"] = view.GetProperty("scoresVisibleToStudents").GetBoolean(),
        ["questions"] = new JsonArray(view.GetProperty("questions").EnumerateArray().Select(q => (JsonNode?)new JsonObject
        {
            ["id"] = q.GetProperty("id").GetGuid(),
            ["text"] = q.GetProperty("text").GetString(),
            ["points"] = q.GetProperty("points").GetInt32(),
            ["options"] = new JsonArray(q.GetProperty("options").EnumerateArray().Select(o => (JsonNode?)new JsonObject
            {
                ["id"] = o.GetProperty("id").GetGuid(),
                ["text"] = o.GetProperty("text").GetString(),
                ["isCorrect"] = o.GetProperty("isCorrect").GetBoolean(),
            }).ToArray()),
        }).ToArray()),
    };

    public static async Task<JsonElement> StartAsync(HttpClient student, Guid quizId)
    {
        using var response = await student.PostAsync($"/api/student/quizzes/{quizId}/attempt", null);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        return await JsonAsync(response);
    }

    public static async Task AnswerAsync(HttpClient student, JsonElement attempt, int question, int option)
    {
        var q = attempt.GetProperty("questions")[question];
        using var response = await student.PutAsJsonAsync(
            $"/api/student/attempts/{attempt.GetProperty("id").GetGuid()}/answers/{q.GetProperty("id").GetGuid()}",
            new { selectedOptionId = q.GetProperty("options")[option].GetProperty("id").GetGuid() });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    public static async Task<JsonElement> SubmitAsync(HttpClient student, JsonElement attempt)
    {
        using var response = await student.PostAsync($"/api/student/attempts/{attempt.GetProperty("id").GetGuid()}/submit", null);
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await JsonAsync(response);
    }

    public static async Task<JsonElement> ResultAsync(HttpClient student, JsonElement attempt)
    {
        using var response = await student.GetAsync($"/api/student/attempts/{attempt.GetProperty("id").GetGuid()}/result");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await JsonAsync(response);
    }

    public static async Task<JsonElement> DetailAsync(HttpClient teacher, Guid quizId, JsonElement attempt)
    {
        using var response = await teacher.GetAsync($"/api/teacher/quizzes/{quizId}/attempts/{attempt.GetProperty("id").GetGuid()}");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return await JsonAsync(response);
    }
}
