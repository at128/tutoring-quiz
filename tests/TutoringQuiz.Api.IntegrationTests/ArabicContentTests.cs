using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;
using TutoringQuiz.Infrastructure.Persistence;

namespace TutoringQuiz.Api.IntegrationTests;

public sealed class ArabicContentTests(TestAppFactory factory) : IClassFixture<TestAppFactory>
{
    [Fact]
    public async Task ArabicWithTashkeel_AtEveryMaximumLength_RoundTripsToStudentUnchanged()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        var title = string.Concat(Enumerable.Repeat("عَ", 100)); // 200 UTF-16 characters
        var question = string.Concat(Enumerable.Repeat("سُ", 1000)); // 2000
        var correct = string.Concat(Enumerable.Repeat("صَ", 250)); // 500
        var wrong = string.Concat(Enumerable.Repeat("خَ", 250)); // 500

        var id = await CreateQuizAsync(teacher, data.ClassRoom.Id, factory.Clock.GetUtcNow().UtcDateTime,
            title, question, correct, wrong);
        using (var published = await teacher.PostAsync($"/api/teacher/quizzes/{id}/publish", null))
            Assert.Equal(HttpStatusCode.OK, published.StatusCode);

        using var started = await student.PostAsync($"/api/student/quizzes/{id}/attempt", null);
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        using var body = JsonDocument.Parse(await started.Content.ReadAsStringAsync());
        Assert.Equal(title, body.RootElement.GetProperty("quizTitle").GetString());
        var actualQuestion = body.RootElement.GetProperty("questions")[0];
        Assert.Equal(question, actualQuestion.GetProperty("text").GetString());
        Assert.Equal(correct, actualQuestion.GetProperty("options")[0].GetProperty("text").GetString());
        Assert.Equal(wrong, actualQuestion.GetProperty("options")[1].GetProperty("text").GetString());
        Assert.False(actualQuestion.GetProperty("options")[0].TryGetProperty("isCorrect", out _));
    }

    [Fact]
    public async Task ArabicMaximumPlusOne_AndFieldsThatShowNothing_AreRejectedWithoutCreatingAQuiz()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        var now = factory.Clock.GetUtcNow().UtcDateTime;
        var maxTitle = string.Concat(Enumerable.Repeat("عَ", 100));
        var maxQuestion = string.Concat(Enumerable.Repeat("سُ", 1000));
        var maxOption = string.Concat(Enumerable.Repeat("صَ", 250));
        var cases = new (string Field, string Title, string Question, string Correct)[]
        {
            ("title", maxTitle + "ع", "سؤال صحيح", "صحيح"),
            ("questions[0].text", "عنوان صحيح", maxQuestion + "س", "صحيح"),
            ("questions[0].options[0].text", "عنوان صحيح", "سؤال صحيح", maxOption + "ص"),
            ("title", "\u00a0\u00a0\u00a0", "سؤال صحيح", "صحيح"),
            ("questions[0].text", "عنوان صحيح", "\u00a0\u00a0", "صحيح"),
            ("questions[0].options[0].text", "عنوان صحيح", "سؤال صحيح", "\u00a0\u00a0"),
            // Text that shows nothing is empty too: tatweel, diacritics, invisible marks (the editor applies the same rule).
            ("title", "\u0640\u0640\u0640", "سؤال صحيح", "صحيح"),
            ("title", "\u200f\u200f\u200f", "سؤال صحيح", "صحيح"),
            ("questions[0].text", "عنوان صحيح", "\u0640\u064e\u0640\u0650", "صحيح"),
            ("questions[0].options[0].text", "عنوان صحيح", "سؤال صحيح", "\u200c\u00a0"),
        };

        foreach (var testCase in cases)
        {
            using var response = await teacher.PostAsJsonAsync("/api/teacher/quizzes",
                Draft(data.ClassRoom.Id, now, testCase.Title, testCase.Question, testCase.Correct, "خطأ"));
            Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
            using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
            Assert.Equal("validation_failed", body.RootElement.GetProperty("code").GetString());
            Assert.True(body.RootElement.GetProperty("errors").TryGetProperty(testCase.Field, out _), testCase.Field);
        }

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(2, await db.Quizzes.CountAsync(quiz => quiz.TeacherId == data.Teacher.Id));
    }

    [Fact]
    public async Task MixedArabicEnglishDigitsAndDirectionMarks_RoundTrip_AndArabicNameAppearsInResults()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        const string title = "\u200fاختبار English 123 \u200eفصل\u200c";
        const string question = "\u200fما ناتج 2 + 3؟ English\u200e\u200c";
        const string correct = "\u200fخمسة 5\u200e\u200c";
        var id = await CreateQuizAsync(teacher, data.ClassRoom.Id, factory.Clock.GetUtcNow().UtcDateTime,
            title, question, correct, "أربعة 4");
        using (var published = await teacher.PostAsync($"/api/teacher/quizzes/{id}/publish", null))
            Assert.Equal(HttpStatusCode.OK, published.StatusCode);

        using var started = await student.PostAsync($"/api/student/quizzes/{id}/attempt", null);
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        using var attempt = JsonDocument.Parse(await started.Content.ReadAsStringAsync());
        Assert.Equal(title, attempt.RootElement.GetProperty("quizTitle").GetString());
        var actualQuestion = attempt.RootElement.GetProperty("questions")[0];
        Assert.Equal(question, actualQuestion.GetProperty("text").GetString());
        Assert.Equal(correct, actualQuestion.GetProperty("options")[0].GetProperty("text").GetString());

        var attemptId = attempt.RootElement.GetProperty("id").GetGuid();
        using (var submitted = await student.PostAsync($"/api/student/attempts/{attemptId}/submit", null))
            Assert.Equal(HttpStatusCode.OK, submitted.StatusCode);
        using var results = await teacher.GetAsync($"/api/teacher/quizzes/{id}/results");
        Assert.Equal(HttpStatusCode.OK, results.StatusCode);
        using var resultBody = JsonDocument.Parse(await results.Content.ReadAsStringAsync());
        var row = resultBody.RootElement.GetProperty("rows").EnumerateArray()
            .Single(item => item.GetProperty("studentId").GetGuid() == data.Student.Id);
        Assert.Equal(data.Student.FullName, row.GetProperty("fullName").GetString());
        Assert.Equal("Submitted", row.GetProperty("status").GetString());
    }

    [Fact]
    public async Task WordsStretchedWithTatweel_AndArabicPunctuationOrDigits_AreRealContent()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);

        var id = await CreateQuizAsync(teacher, data.ClassRoom.Id, factory.Clock.GetUtcNow().UtcDateTime,
            "اختبـــار", "؟", "٣", "عـربي");

        using var saved = await teacher.GetAsync($"/api/teacher/quizzes/{id}");
        using var body = JsonDocument.Parse(await saved.Content.ReadAsStringAsync());
        Assert.Equal("اختبـــار", body.RootElement.GetProperty("title").GetString());
        var question = body.RootElement.GetProperty("questions")[0];
        Assert.Equal("؟", question.GetProperty("text").GetString());
        Assert.Equal("٣", question.GetProperty("options")[0].GetProperty("text").GetString());
    }

    private static async Task<Guid> CreateQuizAsync(HttpClient teacher, Guid classId, DateTime now,
        string title, string question, string correct, string wrong)
    {
        using var created = await teacher.PostAsJsonAsync("/api/teacher/quizzes", Draft(classId, now, title, question, correct, wrong));
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        using var body = JsonDocument.Parse(await created.Content.ReadAsStringAsync());
        return body.RootElement.GetProperty("id").GetGuid();
    }

    private static object Draft(Guid classId, DateTime now, string title, string question, string correct, string wrong) => new
    {
        title,
        description = (string?)null,
        classRoomIds = new[] { classId },
        opensAt = now.AddMinutes(-5),
        closesAt = now.AddHours(1),
        durationMinutes = 20,
        wrongAnswerPenaltyPercent = 25,
        questions = new[] { new
        {
            text = question,
            points = 2,
            options = new[]
            {
                new { text = correct, isCorrect = true },
                new { text = wrong, isCorrect = false },
            },
        } },
    };
}
