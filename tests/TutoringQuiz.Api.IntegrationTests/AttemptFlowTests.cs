using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;
using TutoringQuiz.Infrastructure.Persistence;

namespace TutoringQuiz.Api.IntegrationTests;

public sealed class AttemptFlowTests(TestAppFactory factory) : IClassFixture<TestAppFactory>
{
    [Fact] // I1
    public async Task Start_AfterSubmitting_ReturnsAlreadyTakenAndKeepsOneRow()
    {
        var data = await TestData.CreateAsync(factory);
        using var client = await TestData.LoginAsync(factory, data.Student);

        using var started = await StartAsync(client, data.Quiz.Id);
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var attemptId = (await JsonAsync(started)).GetProperty("id").GetGuid();
        using var submitted = await client.PostAsync($"/api/student/attempts/{attemptId}/submit", null);
        Assert.Equal(HttpStatusCode.OK, submitted.StatusCode);

        using var again = await StartAsync(client, data.Quiz.Id);
        Assert.Equal(HttpStatusCode.Conflict, again.StatusCode);
        Assert.Equal("attempt.already_taken", (await JsonAsync(again)).GetProperty("code").GetString());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.QuizAttempts.CountAsync(a => a.QuizId == data.Quiz.Id && a.StudentId == data.Student.Id));
    }

    [Fact] // I2
    public async Task Start_WhileRunning_ResumesSameAttemptWithSavedAnswers()
    {
        var data = await TestData.CreateAsync(factory);
        using var client = await TestData.LoginAsync(factory, data.Student);
        using var started = await StartAsync(client, data.Quiz.Id);
        var first = await JsonAsync(started);
        var attemptId = first.GetProperty("id").GetGuid();
        var question = data.Quiz.Questions[0];
        var optionId = question.Options[0].Id;

        using var saved = await client.PutAsJsonAsync(
            $"/api/student/attempts/{attemptId}/answers/{question.Id}", new { selectedOptionId = optionId });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);

        using var resumed = await StartAsync(client, data.Quiz.Id);
        Assert.Equal(HttpStatusCode.OK, resumed.StatusCode);
        var second = await JsonAsync(resumed);
        Assert.Equal(attemptId, second.GetProperty("id").GetGuid());
        Assert.Equal(optionId, second.GetProperty("questions")[0].GetProperty("selectedOptionId").GetGuid());
    }

    [Fact] // I3
    public async Task TwoConcurrentStarts_ReturnSameAttemptAndCreateOneRow()
    {
        var data = await TestData.CreateAsync(factory);
        using var firstClient = await TestData.LoginAsync(factory, data.Student);
        using var secondClient = await TestData.LoginAsync(factory, data.Student);

        var responses = await Task.WhenAll(StartAsync(firstClient, data.Quiz.Id), StartAsync(secondClient, data.Quiz.Id));
        using var first = responses[0];
        using var second = responses[1];
        Assert.Contains(first.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Created });
        Assert.Contains(second.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Created });
        Assert.Equal((await JsonAsync(first)).GetProperty("id").GetGuid(),
            (await JsonAsync(second)).GetProperty("id").GetGuid());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(1, await db.QuizAttempts.CountAsync(a => a.QuizId == data.Quiz.Id && a.StudentId == data.Student.Id));
    }

    [Fact] // I4
    public async Task Start_OutsideOpeningWindow_ReturnsNamedConflict()
    {
        var now = factory.Clock.GetUtcNow().UtcDateTime;
        var upcoming = await TestData.CreateAsync(factory, opensAt: now.AddMinutes(5), closesAt: now.AddHours(1));
        var closed = await TestData.CreateAsync(factory, opensAt: now.AddHours(-2), closesAt: now);
        using var upcomingClient = await TestData.LoginAsync(factory, upcoming.Student);
        using var closedClient = await TestData.LoginAsync(factory, closed.Student);

        using var early = await StartAsync(upcomingClient, upcoming.Quiz.Id);
        using var late = await StartAsync(closedClient, closed.Quiz.Id);
        Assert.Equal(HttpStatusCode.Conflict, early.StatusCode);
        Assert.Equal("quiz.not_open_yet", (await JsonAsync(early)).GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
        Assert.Equal("quiz.closed", (await JsonAsync(late)).GetProperty("code").GetString());
    }

    [Fact] // I5
    public async Task AttemptView_DoesNotRevealCorrectAnswers()
    {
        var data = await TestData.CreateAsync(factory);
        using var client = await TestData.LoginAsync(factory, data.Student);
        using var started = await StartAsync(client, data.Quiz.Id);
        var raw = await started.Content.ReadAsStringAsync();
        Assert.False(raw.Contains("isCorrect", StringComparison.OrdinalIgnoreCase));
        Assert.False(raw.Contains("correctOptionId", StringComparison.OrdinalIgnoreCase));
        Assert.Equal(4, (await JsonAsyncFromString(raw)).GetProperty("questions").GetArrayLength());
    }

    [Fact] // I6
    public async Task SaveAnswer_RejectsWrongQuestionOptionAndAnotherStudentsAttempt()
    {
        var data = await TestData.CreateAsync(factory);
        using var owner = await TestData.LoginAsync(factory, data.Student);
        using var otherStudent = await TestData.LoginAsync(factory, data.SecondStudent);
        using var started = await StartAsync(owner, data.Quiz.Id);
        var attemptId = (await JsonAsync(started)).GetProperty("id").GetGuid();

        using var wrongOption = await owner.PutAsJsonAsync(
            $"/api/student/attempts/{attemptId}/answers/{data.Quiz.Questions[0].Id}",
            new { selectedOptionId = data.Quiz.Questions[1].Options[0].Id });
        using var wrongQuestion = await owner.PutAsJsonAsync(
            $"/api/student/attempts/{attemptId}/answers/{data.OtherClassQuiz.Questions[0].Id}",
            new { selectedOptionId = data.OtherClassQuiz.Questions[0].Options[0].Id });
        using var notOwned = await otherStudent.PutAsJsonAsync(
            $"/api/student/attempts/{attemptId}/answers/{data.Quiz.Questions[0].Id}",
            new { selectedOptionId = data.Quiz.Questions[0].Options[0].Id });

        Assert.Equal(HttpStatusCode.BadRequest, wrongOption.StatusCode);
        Assert.Equal("answer.invalid_option", (await JsonAsync(wrongOption)).GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.BadRequest, wrongQuestion.StatusCode);
        Assert.Equal("answer.invalid_option", (await JsonAsync(wrongQuestion)).GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.NotFound, notOwned.StatusCode);
    }

    [Fact] // I7
    public async Task SaveAfterDeadline_ExpiresWithoutWritingAndLateSubmitUsesOnlySavedAnswers()
    {
        var data = await TestData.CreateAsync(factory);
        using var client = await TestData.LoginAsync(factory, data.Student);
        using var started = await StartAsync(client, data.Quiz.Id);
        var attemptId = (await JsonAsync(started)).GetProperty("id").GetGuid();
        var first = data.Quiz.Questions[0];
        var second = data.Quiz.Questions[1];
        using var saved = await client.PutAsJsonAsync(
            $"/api/student/attempts/{attemptId}/answers/{first.Id}", new { selectedOptionId = first.Options[0].Id });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);

        factory.Clock.Advance(TimeSpan.FromMinutes(20) + TimeSpan.FromSeconds(1));
        using var late = await client.PutAsJsonAsync(
            $"/api/student/attempts/{attemptId}/answers/{second.Id}", new { selectedOptionId = second.Options[0].Id });
        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
        Assert.Equal("attempt.deadline_passed", (await JsonAsync(late)).GetProperty("code").GetString());

        using var submitted = await client.PostAsync($"/api/student/attempts/{attemptId}/submit", null);
        var result = await JsonAsync(submitted);
        Assert.Equal(HttpStatusCode.OK, submitted.StatusCode);
        Assert.Equal("Expired", result.GetProperty("status").GetString());
        Assert.Equal(4m, result.GetProperty("score").GetDecimal());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var attempt = await db.QuizAttempts.Include(a => a.Answers).SingleAsync(a => a.Id == attemptId);
        Assert.Single(attempt.Answers);
    }

    [Fact] // I8
    public async Task Submit_ComputesScoreOnServerAndIgnoresForgedBody()
    {
        var data = await TestData.CreateAsync(factory);
        using var client = await TestData.LoginAsync(factory, data.Student);
        using var started = await StartAsync(client, data.Quiz.Id);
        var attemptId = (await JsonAsync(started)).GetProperty("id").GetGuid();

        foreach (var (index, correct) in new[] { (0, true), (1, false), (3, false) })
        {
            var question = data.Quiz.Questions[index];
            using var saved = await client.PutAsJsonAsync(
                $"/api/student/attempts/{attemptId}/answers/{question.Id}",
                new { selectedOptionId = question.Options[correct ? 0 : 1].Id });
            Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        }

        using var submitted = await client.PostAsJsonAsync($"/api/student/attempts/{attemptId}/submit",
            new { score = 9999, studentId = data.SecondStudent.Id });
        var result = await JsonAsync(submitted);
        Assert.Equal(HttpStatusCode.OK, submitted.StatusCode);
        Assert.Equal(3.25m, result.GetProperty("score").GetDecimal());
        Assert.Equal(36.1m, result.GetProperty("percentage").GetDecimal());
        Assert.Equal(1, result.GetProperty("correctCount").GetInt32());
        Assert.Equal(2, result.GetProperty("wrongCount").GetInt32());
        Assert.Equal(1, result.GetProperty("unansweredCount").GetInt32());
    }

    [Fact] // I11
    public async Task Student_CannotListOrStartUnpublishedOrOtherClassQuiz()
    {
        var data = await TestData.CreateAsync(factory, published: false);
        using var client = await TestData.LoginAsync(factory, data.Student);
        using var list = await client.GetAsync("/api/student/quizzes");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        Assert.Empty((await JsonAsync(list)).GetProperty("quizzes").EnumerateArray());

        using var unpublished = await StartAsync(client, data.Quiz.Id);
        using var otherClass = await StartAsync(client, data.OtherClassQuiz.Id);
        Assert.Equal(HttpStatusCode.NotFound, unpublished.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, otherClass.StatusCode);
    }

    [Fact] // I16
    public async Task SubmitTwice_ReturnsTheSameFinalResult()
    {
        var data = await TestData.CreateAsync(factory);
        using var client = await TestData.LoginAsync(factory, data.Student);
        using var started = await StartAsync(client, data.Quiz.Id);
        var attemptId = (await JsonAsync(started)).GetProperty("id").GetGuid();

        using var first = await client.PostAsync($"/api/student/attempts/{attemptId}/submit", null);
        using var second = await client.PostAsync($"/api/student/attempts/{attemptId}/submit", null);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        var firstResult = await JsonAsync(first);
        var secondResult = await JsonAsync(second);
        Assert.Equal(firstResult.GetProperty("attemptId").GetGuid(), secondResult.GetProperty("attemptId").GetGuid());
        Assert.Equal(firstResult.GetProperty("status").GetString(), secondResult.GetProperty("status").GetString());
        Assert.Equal(firstResult.GetProperty("finalizedAt").GetDateTime(), secondResult.GetProperty("finalizedAt").GetDateTime());
        Assert.Equal(firstResult.GetProperty("score").GetDecimal(), secondResult.GetProperty("score").GetDecimal());
        Assert.Equal(firstResult.GetProperty("correctCount").GetInt32(), secondResult.GetProperty("correctCount").GetInt32());
        Assert.Equal(firstResult.GetProperty("wrongCount").GetInt32(), secondResult.GetProperty("wrongCount").GetInt32());
        Assert.Equal(firstResult.GetProperty("unansweredCount").GetInt32(), secondResult.GetProperty("unansweredCount").GetInt32());
    }

    [Fact]
    public async Task Result_BeforeSubmitIsConflict_ThenGetAttemptContainsResultWithoutQuestions()
    {
        var data = await TestData.CreateAsync(factory);
        using var client = await TestData.LoginAsync(factory, data.Student);
        using var started = await StartAsync(client, data.Quiz.Id);
        var attemptId = (await JsonAsync(started)).GetProperty("id").GetGuid();

        using var early = await client.GetAsync($"/api/student/attempts/{attemptId}/result");
        Assert.Equal(HttpStatusCode.Conflict, early.StatusCode);
        Assert.Equal("attempt.not_finalized", (await JsonAsync(early)).GetProperty("code").GetString());

        using var submitted = await client.PostAsync($"/api/student/attempts/{attemptId}/submit", null);
        using var view = await client.GetAsync($"/api/student/attempts/{attemptId}");
        var body = await JsonAsync(view);
        Assert.Equal(HttpStatusCode.OK, view.StatusCode);
        Assert.Empty(body.GetProperty("questions").EnumerateArray());
        Assert.Equal("Submitted", body.GetProperty("result").GetProperty("status").GetString());
    }

    [Fact]
    public async Task SaveAnswer_RequiresSelectedOptionIdPropertyButAllowsExplicitNull()
    {
        var data = await TestData.CreateAsync(factory);
        using var client = await TestData.LoginAsync(factory, data.Student);
        using var started = await StartAsync(client, data.Quiz.Id);
        var attemptId = (await JsonAsync(started)).GetProperty("id").GetGuid();
        var questionId = data.Quiz.Questions[0].Id;

        using var missing = await client.PutAsJsonAsync(
            $"/api/student/attempts/{attemptId}/answers/{questionId}", new { });
        Assert.Equal(HttpStatusCode.BadRequest, missing.StatusCode);

        using var cleared = await client.PutAsJsonAsync(
            $"/api/student/attempts/{attemptId}/answers/{questionId}", new { selectedOptionId = (Guid?)null });
        Assert.Equal(HttpStatusCode.OK, cleared.StatusCode);
        Assert.Equal(JsonValueKind.Null, (await JsonAsync(cleared)).GetProperty("selectedOptionId").ValueKind);
    }

    [Fact]
    public async Task SaveAnswer_AtExactDeadlineSucceeds_OneTickLaterExpires()
    {
        var data = await TestData.CreateAsync(factory);
        using var client = await TestData.LoginAsync(factory, data.Student);
        using var started = await StartAsync(client, data.Quiz.Id);
        var body = await JsonAsync(started);
        var attemptId = body.GetProperty("id").GetGuid();
        var deadline = body.GetProperty("deadline").GetDateTimeOffset();
        var question = data.Quiz.Questions[0];

        factory.Clock.SetUtcNow(deadline);
        using var onTime = await client.PutAsJsonAsync(
            $"/api/student/attempts/{attemptId}/answers/{question.Id}",
            new { selectedOptionId = question.Options[0].Id });
        Assert.Equal(HttpStatusCode.OK, onTime.StatusCode);

        factory.Clock.Advance(TimeSpan.FromTicks(1));
        using var late = await client.PutAsJsonAsync(
            $"/api/student/attempts/{attemptId}/answers/{question.Id}",
            new { selectedOptionId = question.Options[1].Id });
        Assert.Equal(HttpStatusCode.Conflict, late.StatusCode);
        Assert.Equal("attempt.deadline_passed", (await JsonAsync(late)).GetProperty("code").GetString());

        using var resultResponse = await client.GetAsync($"/api/student/attempts/{attemptId}/result");
        var result = await JsonAsync(resultResponse);
        Assert.Equal(HttpStatusCode.OK, resultResponse.StatusCode);
        Assert.Equal("Expired", result.GetProperty("status").GetString());
        Assert.Equal(4m, result.GetProperty("score").GetDecimal());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var answer = (await db.QuizAttempts.Include(a => a.Answers)
            .SingleAsync(a => a.Id == attemptId)).Answers.Single();
        Assert.Equal(question.Options[0].Id, answer.SelectedOptionId);
    }

    [Fact]
    public async Task ClearAnswer_ChangesThePersistedSelectionAndMakesQuestionUnanswered()
    {
        var data = await TestData.CreateAsync(factory);
        using var client = await TestData.LoginAsync(factory, data.Student);
        using var started = await StartAsync(client, data.Quiz.Id);
        var attemptId = (await JsonAsync(started)).GetProperty("id").GetGuid();
        var question = data.Quiz.Questions[0];

        using var selected = await client.PutAsJsonAsync(
            $"/api/student/attempts/{attemptId}/answers/{question.Id}",
            new { selectedOptionId = question.Options[0].Id });
        Assert.Equal(HttpStatusCode.OK, selected.StatusCode);
        using var cleared = await client.PutAsJsonAsync(
            $"/api/student/attempts/{attemptId}/answers/{question.Id}",
            new { selectedOptionId = (Guid?)null });
        Assert.Equal(HttpStatusCode.OK, cleared.StatusCode);

        using var submitted = await client.PostAsync($"/api/student/attempts/{attemptId}/submit", null);
        var result = await JsonAsync(submitted);
        Assert.Equal(0m, result.GetProperty("score").GetDecimal());
        Assert.Equal(4, result.GetProperty("unansweredCount").GetInt32());

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var answer = (await db.QuizAttempts.Include(a => a.Answers)
            .SingleAsync(a => a.Id == attemptId)).Answers.Single();
        Assert.Null(answer.SelectedOptionId);
    }

    [Fact]
    public async Task OtherStudent_CannotReadSubmitOrFetchResultOfAnAttempt()
    {
        var data = await TestData.CreateAsync(factory);
        using var owner = await TestData.LoginAsync(factory, data.Student);
        using var outsider = await TestData.LoginAsync(factory, data.SecondStudent);
        using var started = await StartAsync(owner, data.Quiz.Id);
        var id = (await JsonAsync(started)).GetProperty("id").GetGuid();
        var path = $"/api/student/attempts/{id}";

        using var read = await outsider.GetAsync(path);
        using var submit = await outsider.PostAsync(path + "/submit", null);
        using var result = await outsider.GetAsync(path + "/result");
        foreach (var response in new[] { read, submit, result })
        {
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("not_found", (await JsonAsync(response)).GetProperty("code").GetString());
        }
        using var ownerRead = await owner.GetAsync(path);
        Assert.Equal("InProgress", (await JsonAsync(ownerRead)).GetProperty("status").GetString());
    }

    [Fact]
    public async Task TwoConcurrentSaves_ToDifferentQuestionsBothPersist()
    {
        var data = await TestData.CreateAsync(factory);
        using var firstTab = await TestData.LoginAsync(factory, data.Student);
        using var secondTab = await TestData.LoginAsync(factory, data.Student);
        using var started = await StartAsync(firstTab, data.Quiz.Id);
        var id = (await JsonAsync(started)).GetProperty("id").GetGuid();
        var first = data.Quiz.Questions[0];
        var second = data.Quiz.Questions[1];

        var responses = await Task.WhenAll(
            firstTab.PutAsJsonAsync($"/api/student/attempts/{id}/answers/{first.Id}",
                new { selectedOptionId = first.Options[0].Id }),
            secondTab.PutAsJsonAsync($"/api/student/attempts/{id}/answers/{second.Id}",
                new { selectedOptionId = second.Options[0].Id }));
        using var firstResponse = responses[0];
        using var secondResponse = responses[1];
        Assert.Equal(HttpStatusCode.OK, firstResponse.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondResponse.StatusCode);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var saved = (await db.QuizAttempts.Include(a => a.Answers).SingleAsync(a => a.Id == id)).Answers;
        Assert.Equal(2, saved.Count);
        Assert.Contains(saved, answer => answer.QuestionId == first.Id && answer.SelectedOptionId == first.Options[0].Id);
        Assert.Contains(saved, answer => answer.QuestionId == second.Id && answer.SelectedOptionId == second.Options[0].Id);
    }

    [Fact]
    public async Task AnswerRacingSubmit_NeverChangesTheFinalScoreAfterward()
    {
        var data = await TestData.CreateAsync(factory);
        using var answerTab = await TestData.LoginAsync(factory, data.Student);
        using var submitTab = await TestData.LoginAsync(factory, data.Student);
        using var started = await StartAsync(answerTab, data.Quiz.Id);
        var id = (await JsonAsync(started)).GetProperty("id").GetGuid();
        var question = data.Quiz.Questions[0];

        var responses = await Task.WhenAll(
            answerTab.PutAsJsonAsync($"/api/student/attempts/{id}/answers/{question.Id}",
                new { selectedOptionId = question.Options[0].Id }),
            submitTab.PostAsync($"/api/student/attempts/{id}/submit", null));
        using var answer = responses[0];
        using var submit = responses[1];
        Assert.Contains(answer.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Conflict });
        Assert.Equal(HttpStatusCode.OK, submit.StatusCode);
        var score = (await JsonAsync(submit)).GetProperty("score").GetDecimal();
        Assert.Equal(answer.StatusCode == HttpStatusCode.OK ? 4m : 0m, score);

        using var repeat = await submitTab.PostAsync($"/api/student/attempts/{id}/submit", null);
        Assert.Equal(score, (await JsonAsync(repeat)).GetProperty("score").GetDecimal());
        using var lateSave = await answerTab.PutAsJsonAsync($"/api/student/attempts/{id}/answers/{question.Id}",
            new { selectedOptionId = question.Options[1].Id });
        Assert.Equal(HttpStatusCode.Conflict, lateSave.StatusCode);
        Assert.Equal("attempt.not_in_progress", (await JsonAsync(lateSave)).GetProperty("code").GetString());
    }

    [Fact]
    public async Task StartAtOpeningAndNearClosing_UsesTheShorterServerDeadline()
    {
        var now = factory.Clock.GetUtcNow().UtcDateTime;
        var data = await TestData.CreateAsync(factory, opensAt: now, closesAt: now.AddMinutes(5));
        using var client = await TestData.LoginAsync(factory, data.Student);

        using var started = await StartAsync(client, data.Quiz.Id);
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var view = await JsonAsync(started);
        Assert.Equal(data.Quiz.ClosesAtUtc, view.GetProperty("deadline").GetDateTime());
    }

    [Fact]
    public async Task StudentList_ShowsShortEffectiveTime_ThenLazyExpiresAnAbandonedAttempt()
    {
        var now = factory.Clock.GetUtcNow().UtcDateTime;
        var data = await TestData.CreateAsync(factory, opensAt: now.AddMinutes(-1), closesAt: now.AddMinutes(8));
        using var client = await TestData.LoginAsync(factory, data.Student);

        using var available = await client.GetAsync("/api/student/quizzes");
        var availableQuiz = (await JsonAsync(available)).GetProperty("quizzes").EnumerateArray()
            .Single(q => q.GetProperty("id").GetGuid() == data.Quiz.Id);
        Assert.Equal("Available", availableQuiz.GetProperty("status").GetString());
        Assert.Equal(8, availableQuiz.GetProperty("effectiveMinutesIfStartedNow").GetInt32());

        using var started = await StartAsync(client, data.Quiz.Id);
        var id = (await JsonAsync(started)).GetProperty("id").GetGuid();
        using var running = await client.GetAsync("/api/student/quizzes");
        var runningQuiz = (await JsonAsync(running)).GetProperty("quizzes").EnumerateArray()
            .Single(q => q.GetProperty("id").GetGuid() == data.Quiz.Id);
        Assert.Equal("InProgress", runningQuiz.GetProperty("status").GetString());
        Assert.Equal(id, runningQuiz.GetProperty("attempt").GetProperty("id").GetGuid());
        Assert.Equal(JsonValueKind.Null, runningQuiz.GetProperty("effectiveMinutesIfStartedNow").ValueKind);

        factory.Clock.Advance(TimeSpan.FromMinutes(8) + TimeSpan.FromTicks(1));
        using var completed = await client.GetAsync("/api/student/quizzes");
        var completedQuiz = (await JsonAsync(completed)).GetProperty("quizzes").EnumerateArray()
            .Single(q => q.GetProperty("id").GetGuid() == data.Quiz.Id);
        Assert.Equal("Completed", completedQuiz.GetProperty("status").GetString());
        Assert.Equal("Expired", completedQuiz.GetProperty("attempt").GetProperty("status").GetString());
        Assert.Equal(0m, completedQuiz.GetProperty("attempt").GetProperty("score").GetDecimal());
    }

    private static Task<HttpResponseMessage> StartAsync(HttpClient client, Guid quizId) =>
        client.PostAsync($"/api/student/quizzes/{quizId}/attempt", null);

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        await JsonAsyncFromString(await response.Content.ReadAsStringAsync());

    private static Task<JsonElement> JsonAsyncFromString(string content)
    {
        using var document = JsonDocument.Parse(content);
        return Task.FromResult(document.RootElement.Clone());
    }
}
