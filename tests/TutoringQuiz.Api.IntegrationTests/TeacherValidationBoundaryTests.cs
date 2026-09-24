using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;
using TutoringQuiz.Infrastructure.Persistence;

namespace TutoringQuiz.Api.IntegrationTests;

public sealed class TeacherValidationBoundaryTests(TestAppFactory factory) : IClassFixture<TestAppFactory>
{
    [Fact]
    public async Task RejectedPublishedUpdate_LeavesTheOriginalContentAndAssignmentsIntact()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        var path = $"/api/teacher/quizzes/{data.Quiz.Id}";
        var now = factory.Clock.GetUtcNow().UtcDateTime;
        var invalid = new
        {
            title = "This must not persist", description = (string?)null,
            classRoomIds = new[] { data.OtherClassRoom.Id },
            opensAt = now.AddMinutes(-5), closesAt = now.AddHours(1),
            durationMinutes = 20, wrongAnswerPenaltyPercent = 25,
            questions = Array.Empty<object>(),
        };

        using var rejected = await teacher.PutAsJsonAsync(path, invalid);
        Assert.Equal(HttpStatusCode.BadRequest, rejected.StatusCode);
        using (var json = JsonDocument.Parse(await rejected.Content.ReadAsStringAsync()))
            Assert.Equal("quiz.invalid_for_publish", json.RootElement.GetProperty("code").GetString());

        using var unchanged = await teacher.GetAsync(path);
        Assert.Equal(HttpStatusCode.OK, unchanged.StatusCode);
        using var body = JsonDocument.Parse(await unchanged.Content.ReadAsStringAsync());
        Assert.Equal(data.Quiz.Title, body.RootElement.GetProperty("title").GetString());
        Assert.Equal(4, body.RootElement.GetProperty("questions").GetArrayLength());
        var classes = body.RootElement.GetProperty("classRooms").EnumerateArray().ToArray();
        Assert.Single(classes);
        Assert.Equal(data.ClassRoom.Id, classes[0].GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task Create_RejectsEveryDocumentedContentBoundary_WithoutPersistingPartialQuizzes()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        var now = factory.Clock.GetUtcNow().UtcDateTime;
        var valid = new JsonObject
        {
            ["title"] = "Valid title",
            ["description"] = "Description",
            ["classRoomIds"] = new JsonArray(JsonValue.Create(data.ClassRoom.Id)),
            ["opensAt"] = JsonValue.Create(now.AddMinutes(-5)),
            ["closesAt"] = JsonValue.Create(now.AddHours(1)),
            ["durationMinutes"] = 20,
            ["wrongAnswerPenaltyPercent"] = 25,
            ["questions"] = new JsonArray(new JsonObject
            {
                ["text"] = "Question",
                ["points"] = 4,
                ["options"] = new JsonArray(
                    new JsonObject { ["text"] = "Correct", ["isCorrect"] = true },
                    new JsonObject { ["text"] = "Wrong", ["isCorrect"] = false }),
            }),
        };

        static JsonObject Question(JsonObject body) => (JsonObject)((JsonArray)body["questions"]!)[0]!;
        static JsonArray Options(JsonObject body) => (JsonArray)Question(body)["options"]!;
        static JsonObject Option(JsonObject body, int index) => (JsonObject)Options(body)[index]!;

        var cases = new (string Name, string Field, Action<JsonObject> Change)[]
        {
            ("short title", "title", body => body["title"] = "ab"),
            ("long title", "title", body => body["title"] = new string('x', 201)),
            ("long description", "description", body => body["description"] = new string('x', 1001)),
            ("no classes", "classRoomIds", body => body["classRoomIds"] = new JsonArray()),
            ("empty class ID", "classRoomIds", body => body["classRoomIds"] = new JsonArray(JsonValue.Create(Guid.Empty))),
            ("duplicate class ID", "classRoomIds", body => body["classRoomIds"] = new JsonArray(
                JsonValue.Create(data.ClassRoom.Id), JsonValue.Create(data.ClassRoom.Id))),
            ("unknown class ID", "classRoomIds", body => body["classRoomIds"] = new JsonArray(JsonValue.Create(Guid.NewGuid()))),
            ("close at open", "closesAt", body => body["closesAt"] = body["opensAt"]!.DeepClone()),
            ("duration below minimum", "durationMinutes", body => body["durationMinutes"] = 0),
            ("duration above maximum", "durationMinutes", body => body["durationMinutes"] = 181),
            ("penalty below minimum", "wrongAnswerPenaltyPercent", body => body["wrongAnswerPenaltyPercent"] = -1),
            ("penalty above maximum", "wrongAnswerPenaltyPercent", body => body["wrongAnswerPenaltyPercent"] = 101),
            ("empty question text", "questions[0].text", body => Question(body)["text"] = ""),
            ("long question text", "questions[0].text", body => Question(body)["text"] = new string('x', 2001)),
            ("points below minimum", "questions[0].points", body => Question(body)["points"] = 0),
            ("points above maximum", "questions[0].points", body => Question(body)["points"] = 101),
            ("one option", "questions[0].options", body => Options(body).RemoveAt(1)),
            ("seven options", "questions[0].options", body =>
            {
                for (var i = 0; i < 5; i++) Options(body).Add(new JsonObject { ["text"] = $"Extra {i}", ["isCorrect"] = false });
            }),
            ("no correct option", "questions[0].options", body => Option(body, 0)["isCorrect"] = false),
            ("two correct options", "questions[0].options", body => Option(body, 1)["isCorrect"] = true),
            ("empty option text", "questions[0].options[0].text", body => Option(body, 0)["text"] = ""),
            ("long option text", "questions[0].options[0].text", body => Option(body, 0)["text"] = new string('x', 501)),
            ("missing correct flag", "questions[0].options[0].isCorrect", body => { Option(body, 0).Remove("isCorrect"); }),
            ("null question", "questions[0]", body => ((JsonArray)body["questions"]!)[0] = null),
            ("null option", "questions[0].options[0]", body => Options(body)[0] = null),
            ("too many questions", "questions", body => body["questions"] = new JsonArray(
                Enumerable.Range(0, 101).Select(_ => Question(body).DeepClone()).ToArray())),
        };

        foreach (var testCase in cases)
        {
            var body = (JsonObject)valid.DeepClone();
            testCase.Change(body);
            using var response = await teacher.PostAsJsonAsync("/api/teacher/quizzes", body);
            Assert.True(response.StatusCode == HttpStatusCode.BadRequest,
                $"{testCase.Name}: expected 400, got {(int)response.StatusCode}: {await response.Content.ReadAsStringAsync()}");
            using var json = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal("validation_failed", json.RootElement.GetProperty("code").GetString());
            Assert.True(json.RootElement.GetProperty("errors").TryGetProperty(testCase.Field, out _),
                $"{testCase.Name}: missing error for {testCase.Field}");
        }

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(2, await db.Quizzes.CountAsync(q => q.TeacherId == data.Teacher.Id));
    }
}
