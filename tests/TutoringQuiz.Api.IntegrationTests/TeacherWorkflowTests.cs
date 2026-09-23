using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Domain.Quizzes;
using TutoringQuiz.Domain.Users;
using TutoringQuiz.Infrastructure.Persistence;

namespace TutoringQuiz.Api.IntegrationTests;

public sealed class TeacherWorkflowTests(TestAppFactory factory) : IClassFixture<TestAppFactory>
{
    [Fact] // Full author-to-result journey, I13 Arabic round-trip.
    public async Task TeacherCreatesEditsPublishes_StudentTakesArabicQuiz_TeacherSeesResults()
    {
        var data = await TestData.CreateAsync(factory, published: false);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        var payload = Payload(data.ClassRoom.Id, factory.Clock.GetUtcNow().UtcDateTime) with
        {
            Title = "اختبار اللغة العربية",
            Questions = [new QuestionPayload("ما عاصمة الأردن؟", 4,
                [new OptionPayload("عمّان", true), new OptionPayload("إربد", false)])],
        };

        using var created = await teacher.PostAsJsonAsync("/api/teacher/quizzes", payload);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var quizId = (await JsonAsync(created)).GetProperty("id").GetGuid();
        Assert.Equal($"/api/teacher/quizzes/{quizId}", created.Headers.Location?.AbsolutePath);

        using var draft = await teacher.GetAsync($"/api/teacher/quizzes/{quizId}");
        Assert.Equal(HttpStatusCode.OK, draft.StatusCode);
        var draftBody = await JsonAsync(draft);
        Assert.Equal("Draft", draftBody.GetProperty("state").GetString());
        Assert.False(draftBody.GetProperty("isPublished").GetBoolean());
        Assert.Equal("اختبار اللغة العربية", draftBody.GetProperty("title").GetString());

        var oldQuestionId = draftBody.GetProperty("questions")[0].GetProperty("id").GetGuid();
        var revised = payload with { Questions = [new QuestionPayload("كم يساوي ٢ + ٢؟", 5,
            [new OptionPayload("٤", true), new OptionPayload("٣", false)])] };
        using var updated = await teacher.PutAsJsonAsync($"/api/teacher/quizzes/{quizId}", revised);
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        var updatedBody = await JsonAsync(updated);
        Assert.Equal("٤", updatedBody.GetProperty("questions")[0].GetProperty("options")[0].GetProperty("text").GetString());
        Assert.NotEqual(oldQuestionId, updatedBody.GetProperty("questions")[0].GetProperty("id").GetGuid());

        using var published = await teacher.PostAsync($"/api/teacher/quizzes/{quizId}/publish", null);
        Assert.Equal(HttpStatusCode.OK, published.StatusCode);
        Assert.True((await JsonAsync(published)).GetProperty("isPublished").GetBoolean());

        using var list = await student.GetAsync("/api/student/quizzes");
        Assert.Contains((await JsonAsync(list)).GetProperty("quizzes").EnumerateArray(), q => q.GetProperty("id").GetGuid() == quizId);
        using var started = await student.PostAsync($"/api/student/quizzes/{quizId}/attempt", null);
        Assert.Equal(HttpStatusCode.Created, started.StatusCode);
        var startedText = await started.Content.ReadAsStringAsync();
        Assert.Contains("كم يساوي", startedText);
        Assert.DoesNotContain("isCorrect", startedText, StringComparison.OrdinalIgnoreCase);
        var attempt = Parse(startedText);
        var attemptId = attempt.GetProperty("id").GetGuid();
        var question = attempt.GetProperty("questions")[0];
        Assert.Equal("كم يساوي ٢ + ٢؟", question.GetProperty("text").GetString());
        Assert.Equal("٤", question.GetProperty("options")[0].GetProperty("text").GetString());
        var answerUrl = $"/api/student/attempts/{attemptId}/answers/{question.GetProperty("id").GetGuid()}";
        using var saved = await student.PutAsJsonAsync(answerUrl,
            new { selectedOptionId = question.GetProperty("options")[0].GetProperty("id").GetGuid() });
        Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        using var submitted = await student.PostAsync($"/api/student/attempts/{attemptId}/submit", null);
        Assert.Equal(5m, (await JsonAsync(submitted)).GetProperty("score").GetDecimal());

        using var results = await teacher.GetAsync($"/api/teacher/quizzes/{quizId}/results");
        Assert.Equal(HttpStatusCode.OK, results.StatusCode);
        var result = await JsonAsync(results);
        Assert.Equal(2, result.GetProperty("summary").GetProperty("assignedCount").GetInt32());
        Assert.Equal(1, result.GetProperty("summary").GetProperty("startedCount").GetInt32());
        Assert.Equal(1, result.GetProperty("summary").GetProperty("finalizedCount").GetInt32());
        Assert.Equal(5m, result.GetProperty("summary").GetProperty("averageScore").GetDecimal());
        Assert.Contains(result.GetProperty("rows").EnumerateArray(),
            row => row.GetProperty("status").GetString() == "Submitted" && row.GetProperty("score").GetDecimal() == 5m);
        Assert.Contains(result.GetProperty("rows").EnumerateArray(),
            row => row.GetProperty("status").GetString() == "NotStarted");
    }

    [Fact] // I10
    public async Task AnotherTeacher_CannotReadEditPublishUnpublishDeleteOrSeeResults()
    {
        var data = await TestData.CreateAsync(factory);
        var otherTeacher = await AddTeacherAsync();
        using var outsider = await TestData.LoginAsync(factory, otherTeacher);
        var path = $"/api/teacher/quizzes/{data.Quiz.Id}";
        var payload = Payload(data.ClassRoom.Id, factory.Clock.GetUtcNow().UtcDateTime);

        using var read = await outsider.GetAsync(path);
        using var edit = await outsider.PutAsJsonAsync(path, payload);
        using var publish = await outsider.PostAsync(path + "/publish", null);
        using var unpublish = await outsider.PostAsync(path + "/unpublish", null);
        using var delete = await outsider.DeleteAsync(path);
        using var results = await outsider.GetAsync(path + "/results");
        foreach (var response in new[] { read, edit, publish, unpublish, delete, results })
        {
            Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
            Assert.Equal("not_found", await CodeAsync(response));
        }
        using var list = await outsider.GetAsync("/api/teacher/quizzes");
        Assert.DoesNotContain((await JsonAsync(list)).EnumerateArray(),
            quiz => quiz.GetProperty("id").GetGuid() == data.Quiz.Id);
    }

    [Fact] // I12
    public async Task OnceStudentStarts_EditUnpublishAndDeleteAreLocked()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        using var start = await student.PostAsync($"/api/student/quizzes/{data.Quiz.Id}/attempt", null);
        Assert.Equal(HttpStatusCode.Created, start.StatusCode);
        var path = $"/api/teacher/quizzes/{data.Quiz.Id}";

        using var edit = await teacher.PutAsJsonAsync(path, Payload(data.ClassRoom.Id, factory.Clock.GetUtcNow().UtcDateTime));
        using var unpublish = await teacher.PostAsync(path + "/unpublish", null);
        using var delete = await teacher.DeleteAsync(path);
        Assert.Equal("quiz.locked", await CodeAsync(edit));
        Assert.Equal("quiz.has_attempts", await CodeAsync(unpublish));
        Assert.Equal("quiz.has_attempts", await CodeAsync(delete));
        Assert.All(new[] { edit, unpublish, delete }, response => Assert.Equal(HttpStatusCode.Conflict, response.StatusCode));

        using var view = await teacher.GetAsync(path);
        Assert.True((await JsonAsync(view)).GetProperty("isLocked").GetBoolean());
        using var list = await teacher.GetAsync("/api/teacher/quizzes");
        Assert.Contains((await JsonAsync(list)).EnumerateArray(),
            q => q.GetProperty("id").GetGuid() == data.Quiz.Id && q.GetProperty("isLocked").GetBoolean());
    }

    [Fact] // I14
    public async Task Results_LazilyExpireAbandonedAttempt_AndMarkMissedAfterClose()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        using var started = await student.PostAsync($"/api/student/quizzes/{data.Quiz.Id}/attempt", null);
        var attemptId = (await JsonAsync(started)).GetProperty("id").GetGuid();

        factory.Clock.Advance(TimeSpan.FromMinutes(21));
        using var early = await teacher.GetAsync($"/api/teacher/quizzes/{data.Quiz.Id}/results");
        var earlyBody = await JsonAsync(early);
        Assert.Equal(1, earlyBody.GetProperty("summary").GetProperty("finalizedCount").GetInt32());
        Assert.Contains(earlyBody.GetProperty("rows").EnumerateArray(),
            row => row.GetProperty("attemptId").ValueKind != JsonValueKind.Null &&
                   row.GetProperty("attemptId").GetGuid() == attemptId &&
                   row.GetProperty("status").GetString() == "Expired");
        Assert.Contains(earlyBody.GetProperty("rows").EnumerateArray(),
            row => row.GetProperty("status").GetString() == "NotStarted");

        factory.Clock.Advance(TimeSpan.FromMinutes(40));
        using var late = await teacher.GetAsync($"/api/teacher/quizzes/{data.Quiz.Id}/results");
        var lateBody = await JsonAsync(late);
        Assert.Contains(lateBody.GetProperty("rows").EnumerateArray(),
            row => row.GetProperty("status").GetString() == "Missed");
        Assert.Equal(0m, lateBody.GetProperty("summary").GetProperty("averageScore").GetDecimal());
        Assert.Equal("Closed", lateBody.GetProperty("quiz").GetProperty("state").GetString());
    }

    [Fact]
    public async Task PublishedQuiz_CannotBeUpdatedToEmptyQuestions()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        var payload = Payload(data.ClassRoom.Id, factory.Clock.GetUtcNow().UtcDateTime) with { Questions = [] };
        using var response = await teacher.PutAsJsonAsync($"/api/teacher/quizzes/{data.Quiz.Id}", payload);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal("quiz.invalid_for_publish", await CodeAsync(response));
    }

    [Fact]
    public async Task InvalidDraftAndMissingClass_ReturnFieldErrorsWithoutServerErrors()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        var now = factory.Clock.GetUtcNow().UtcDateTime;
        var malformed = Payload(data.ClassRoom.Id, now) with
        {
            Title = "x", DurationMinutes = 0, ClassRoomIds = [data.ClassRoom.Id, data.ClassRoom.Id],
            Questions = [new QuestionPayload("", 0, [new OptionPayload("", false)])],
        };
        using var invalid = await teacher.PostAsJsonAsync("/api/teacher/quizzes", malformed);
        Assert.Equal(HttpStatusCode.BadRequest, invalid.StatusCode);
        var invalidBody = await JsonAsync(invalid);
        Assert.Equal("validation_failed", invalidBody.GetProperty("code").GetString());
        Assert.True(invalidBody.GetProperty("errors").TryGetProperty("classRoomIds", out _));

        using var unknownClass = await teacher.PostAsJsonAsync("/api/teacher/quizzes",
            Payload(Guid.NewGuid(), now));
        Assert.Equal(HttpStatusCode.BadRequest, unknownClass.StatusCode);
        Assert.Equal("validation_failed", await CodeAsync(unknownClass));

        using var missingFields = await teacher.PostAsJsonAsync("/api/teacher/quizzes",
            new { title = "A valid title", classRoomIds = new[] { data.ClassRoom.Id }, questions = Array.Empty<object>() });
        Assert.Equal(HttpStatusCode.BadRequest, missingFields.StatusCode);
        var errors = (await JsonAsync(missingFields)).GetProperty("errors");
        Assert.True(errors.TryGetProperty("opensAt", out _));
        Assert.True(errors.TryGetProperty("wrongAnswerPenaltyPercent", out _));
    }

    [Fact]
    public async Task DraftCanBeRevisedPublishedUnpublishedAndDeleted_ButCannotPublishEmpty()
    {
        var data = await TestData.CreateAsync(factory, published: false);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        var now = factory.Clock.GetUtcNow().UtcDateTime;
        using var created = await teacher.PostAsJsonAsync("/api/teacher/quizzes",
            Payload(data.ClassRoom.Id, now) with { Questions = [] });
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = (await JsonAsync(created)).GetProperty("id").GetGuid();
        var path = $"/api/teacher/quizzes/{id}";

        using var invalidPublish = await teacher.PostAsync(path + "/publish", null);
        Assert.Equal(HttpStatusCode.BadRequest, invalidPublish.StatusCode);
        Assert.Equal("quiz.invalid_for_publish", await CodeAsync(invalidPublish));
        Assert.True((await JsonAsync(invalidPublish)).GetProperty("errors").TryGetProperty("questions", out _));

        using var revised = await teacher.PutAsJsonAsync(path, Payload(data.ClassRoom.Id, now));
        Assert.Equal(HttpStatusCode.OK, revised.StatusCode);
        using var published = await teacher.PostAsync(path + "/publish", null);
        Assert.Equal(HttpStatusCode.OK, published.StatusCode);
        using var visible = await student.GetAsync("/api/student/quizzes");
        Assert.Contains((await JsonAsync(visible)).GetProperty("quizzes").EnumerateArray(),
            quiz => quiz.GetProperty("id").GetGuid() == id);

        using var unpublished = await teacher.PostAsync(path + "/unpublish", null);
        Assert.Equal(HttpStatusCode.OK, unpublished.StatusCode);
        Assert.False((await JsonAsync(unpublished)).GetProperty("isPublished").GetBoolean());
        using var hidden = await student.PostAsync($"/api/student/quizzes/{id}/attempt", null);
        Assert.Equal(HttpStatusCode.NotFound, hidden.StatusCode);

        using var deleted = await teacher.DeleteAsync(path);
        Assert.Equal(HttpStatusCode.NoContent, deleted.StatusCode);
        using var missing = await teacher.GetAsync(path);
        Assert.Equal(HttpStatusCode.NotFound, missing.StatusCode);
    }

    [Fact]
    public async Task InvalidNestedFieldsAndNonUtcTimes_ReturnFieldSpecificValidation()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        var now = factory.Clock.GetUtcNow().UtcDateTime;
        var invalidFields = Payload(data.ClassRoom.Id, now) with
        {
            Title = "x", DurationMinutes = 181, WrongAnswerPenaltyPercent = 101,
            Questions = [new QuestionPayload("", 0, [new OptionPayload("", false)])],
        };
        using var response = await teacher.PostAsJsonAsync("/api/teacher/quizzes", invalidFields);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errors = (await JsonAsync(response)).GetProperty("errors");
        foreach (var field in new[] { "title", "durationMinutes", "wrongAnswerPenaltyPercent",
                     "questions[0].text", "questions[0].points", "questions[0].options",
                     "questions[0].options[0].text" })
            Assert.True(errors.TryGetProperty(field, out _), $"Missing error for {field}");

        var nonUtc = Payload(data.ClassRoom.Id, now) with
        {
            OpensAt = DateTime.SpecifyKind(now.AddMinutes(-5), DateTimeKind.Unspecified),
        };
        using var timeResponse = await teacher.PostAsJsonAsync("/api/teacher/quizzes", nonUtc);
        Assert.Equal(HttpStatusCode.BadRequest, timeResponse.StatusCode);
        Assert.True((await JsonAsync(timeResponse)).GetProperty("errors").TryGetProperty("opensAt", out _));

        using var nullQuestion = await teacher.PostAsJsonAsync("/api/teacher/quizzes", new
        {
            title = "Null nested item", description = (string?)null,
            classRoomIds = new[] { data.ClassRoom.Id },
            opensAt = now.AddMinutes(-5), closesAt = now.AddHours(1),
            durationMinutes = 20, wrongAnswerPenaltyPercent = 0,
            questions = new object?[] { null },
        });
        Assert.Equal(HttpStatusCode.BadRequest, nullQuestion.StatusCode);
        Assert.True((await JsonAsync(nullQuestion)).GetProperty("errors").TryGetProperty("questions[0]", out _));
    }

    [Fact]
    public async Task PublishingAfterClose_ReturnsFieldErrorAndKeepsDraft()
    {
        var data = await TestData.CreateAsync(factory, published: false);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        factory.Clock.Advance(TimeSpan.FromHours(2));

        using var publish = await teacher.PostAsync($"/api/teacher/quizzes/{data.Quiz.Id}/publish", null);
        Assert.Equal(HttpStatusCode.BadRequest, publish.StatusCode);
        Assert.Equal("quiz.invalid_for_publish", await CodeAsync(publish));
        Assert.True((await JsonAsync(publish)).GetProperty("errors").TryGetProperty("closesAt", out _));
        using var view = await teacher.GetAsync($"/api/teacher/quizzes/{data.Quiz.Id}");
        Assert.False((await JsonAsync(view)).GetProperty("isPublished").GetBoolean());
    }

    [Fact]
    public async Task UnpublishedDraftPastItsCloseDoesNotMarkStudentsAsMissed()
    {
        var data = await TestData.CreateAsync(factory, published: false);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        factory.Clock.Advance(TimeSpan.FromHours(2));

        using var results = await teacher.GetAsync($"/api/teacher/quizzes/{data.Quiz.Id}/results");
        Assert.Equal(HttpStatusCode.OK, results.StatusCode);
        var body = await JsonAsync(results);
        Assert.Equal("Draft", body.GetProperty("quiz").GetProperty("state").GetString());
        Assert.All(body.GetProperty("rows").EnumerateArray(),
            row => Assert.Equal("NotStarted", row.GetProperty("status").GetString()));
    }

    [Fact]
    public async Task EditRacingStudentStart_EitherWinsCleanly_WithoutChangingAnActiveAttempt()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        var payload = Payload(data.ClassRoom.Id, factory.Clock.GetUtcNow().UtcDateTime) with
        {
            Questions = [new QuestionPayload("Replacement question", 6,
                [new OptionPayload("Yes", true), new OptionPayload("No", false)])],
        };

        var responses = await Task.WhenAll(
            teacher.PutAsJsonAsync($"/api/teacher/quizzes/{data.Quiz.Id}", payload),
            student.PostAsync($"/api/student/quizzes/{data.Quiz.Id}/attempt", null));
        using var edit = responses[0];
        using var start = responses[1];
        Assert.Contains(edit.StatusCode, new[] { HttpStatusCode.OK, HttpStatusCode.Conflict });
        if (edit.StatusCode == HttpStatusCode.Conflict)
            Assert.Equal("quiz.locked", await CodeAsync(edit));
        Assert.Equal(HttpStatusCode.Created, start.StatusCode);

        var attempt = await JsonAsync(start);
        using var quizResponse = await teacher.GetAsync($"/api/teacher/quizzes/{data.Quiz.Id}");
        var quiz = await JsonAsync(quizResponse);
        Assert.True(quiz.GetProperty("isLocked").GetBoolean());
        Assert.Equal(quiz.GetProperty("maxScore").GetInt32(), attempt.GetProperty("maxScore").GetInt32());
        Assert.Equal(quiz.GetProperty("questions").GetArrayLength(), attempt.GetProperty("questions").GetArrayLength());
        for (var i = 0; i < quiz.GetProperty("questions").GetArrayLength(); i++)
            Assert.Equal(quiz.GetProperty("questions")[i].GetProperty("id").GetGuid(),
                attempt.GetProperty("questions")[i].GetProperty("id").GetGuid());
    }

    [Fact]
    public async Task ChangingAssignedClassBeforePublish_OnlyAllowsTheNewClassToStart()
    {
        var data = await TestData.CreateAsync(factory, published: false);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var oldClassStudent = await TestData.LoginAsync(factory, data.Student);
        using var newClassStudent = await TestData.LoginAsync(factory, data.OtherClassStudent);
        var path = $"/api/teacher/quizzes/{data.Quiz.Id}";
        using var updated = await teacher.PutAsJsonAsync(path,
            Payload(data.OtherClassRoom.Id, factory.Clock.GetUtcNow().UtcDateTime));
        Assert.Equal(HttpStatusCode.OK, updated.StatusCode);
        var classes = (await JsonAsync(updated)).GetProperty("classRooms");
        Assert.Single(classes.EnumerateArray());
        Assert.Equal(data.OtherClassRoom.Id, classes[0].GetProperty("id").GetGuid());

        using var published = await teacher.PostAsync(path + "/publish", null);
        Assert.Equal(HttpStatusCode.OK, published.StatusCode);
        using var forbidden = await oldClassStudent.PostAsync($"/api/student/quizzes/{data.Quiz.Id}/attempt", null);
        using var allowed = await newClassStudent.PostAsync($"/api/student/quizzes/{data.Quiz.Id}/attempt", null);
        Assert.Equal(HttpStatusCode.NotFound, forbidden.StatusCode);
        Assert.Equal(HttpStatusCode.Created, allowed.StatusCode);
    }

    [Fact]
    public async Task NegativeScoresFlowThroughTheResultAndTeacherSummaryWithoutClamping()
    {
        var data = await TestData.CreateAsync(factory, penaltyPercent: 50);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        using var started = await student.PostAsync($"/api/student/quizzes/{data.Quiz.Id}/attempt", null);
        var id = (await JsonAsync(started)).GetProperty("id").GetGuid();
        foreach (var question in data.Quiz.Questions)
        {
            using var saved = await student.PutAsJsonAsync(
                $"/api/student/attempts/{id}/answers/{question.Id}",
                new { selectedOptionId = question.Options[1].Id });
            Assert.Equal(HttpStatusCode.OK, saved.StatusCode);
        }

        using var submitted = await student.PostAsync($"/api/student/attempts/{id}/submit", null);
        var result = await JsonAsync(submitted);
        Assert.Equal(-4.5m, result.GetProperty("score").GetDecimal());
        Assert.Equal(-50m, result.GetProperty("percentage").GetDecimal());
        using var teacherResults = await teacher.GetAsync($"/api/teacher/quizzes/{data.Quiz.Id}/results");
        var summary = (await JsonAsync(teacherResults)).GetProperty("summary");
        Assert.Equal(-4.5m, summary.GetProperty("averageScore").GetDecimal());
        Assert.Equal(-4.5m, summary.GetProperty("highestScore").GetDecimal());
        Assert.Equal(-4.5m, summary.GetProperty("lowestScore").GetDecimal());
        Assert.Equal(-50m, summary.GetProperty("averagePercentage").GetDecimal());
    }

    [Fact]
    public async Task UnpublishRacingStudentStart_CannotHideAnAttemptThatWasAllowedToStart()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        var path = $"/api/teacher/quizzes/{data.Quiz.Id}";

        var responses = await Task.WhenAll(
            teacher.PostAsync(path + "/unpublish", null),
            student.PostAsync($"/api/student/quizzes/{data.Quiz.Id}/attempt", null));
        using var unpublish = responses[0];
        using var start = responses[1];
        if (start.StatusCode == HttpStatusCode.Created)
        {
            Assert.Equal(HttpStatusCode.Conflict, unpublish.StatusCode);
            Assert.Equal("quiz.has_attempts", await CodeAsync(unpublish));
            using var quiz = await teacher.GetAsync(path);
            Assert.True((await JsonAsync(quiz)).GetProperty("isPublished").GetBoolean());
        }
        else
        {
            Assert.Equal(HttpStatusCode.NotFound, start.StatusCode);
            Assert.Equal(HttpStatusCode.OK, unpublish.StatusCode);
            using var scope = factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            Assert.False(await db.QuizAttempts.AnyAsync(a => a.QuizId == data.Quiz.Id));
        }
    }

    [Fact]
    public async Task ClassroomsAndRoles_FollowTheContract()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        using var anonymous = factory.CreateClient();

        using var classes = await teacher.GetAsync("/api/teacher/classrooms");
        Assert.Equal(HttpStatusCode.OK, classes.StatusCode);
        Assert.Contains((await JsonAsync(classes)).EnumerateArray(),
            c => c.GetProperty("id").GetGuid() == data.ClassRoom.Id && c.GetProperty("studentCount").GetInt32() == 2);
        using var wrongRole = await student.GetAsync("/api/teacher/quizzes");
        using var noSession = await anonymous.GetAsync("/api/teacher/quizzes");
        Assert.Equal(HttpStatusCode.Forbidden, wrongRole.StatusCode);
        Assert.Equal("auth.forbidden", await CodeAsync(wrongRole));
        Assert.Equal(HttpStatusCode.Unauthorized, noSession.StatusCode);
        Assert.Equal("auth.unauthenticated", await CodeAsync(noSession));
    }

    [Fact]
    public async Task TeacherList_OrdersStatesAndReportsAssignedStartedAndFinalizedCounts()
    {
        var data = await TestData.CreateAsync(factory);
        var now = factory.Clock.GetUtcNow().UtcDateTime;
        Quiz NewQuiz(string title, DateTime opens, DateTime closes, bool publish)
        {
            var quiz = Quiz.Create(data.Teacher.Id,
                new QuizDetails(title, null, opens, closes, 20, 0), [data.ClassRoom.Id],
                [new QuestionDraft("Question", 2,
                    [new OptionDraft("Yes", true), new OptionDraft("No", false)])], now.AddDays(-2));
            if (publish) quiz.Publish(now.AddDays(-1));
            return quiz;
        }
        var scheduled = NewQuiz("Scheduled", now.AddMinutes(5), now.AddHours(1), true);
        var draft = NewQuiz("Draft", now.AddHours(-2), now.AddHours(1), false);
        var closed = NewQuiz("Closed", now.AddHours(-2), now.AddMinutes(-1), true);
        using (var scope = factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            db.Quizzes.AddRange(scheduled, draft, closed);
            await db.SaveChangesAsync();
        }

        using var student = await TestData.LoginAsync(factory, data.Student);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var start = await student.PostAsync($"/api/student/quizzes/{data.Quiz.Id}/attempt", null);
        var attemptId = (await JsonAsync(start)).GetProperty("id").GetGuid();
        using var submit = await student.PostAsync($"/api/student/attempts/{attemptId}/submit", null);
        Assert.Equal(HttpStatusCode.OK, submit.StatusCode);

        using var list = await teacher.GetAsync("/api/teacher/quizzes");
        Assert.Equal(HttpStatusCode.OK, list.StatusCode);
        var rows = (await JsonAsync(list)).EnumerateArray().ToArray();
        Assert.Equal(new[] { "Open", "Open", "Scheduled", "Draft", "Closed" },
            rows.Select(row => row.GetProperty("state").GetString()));
        var active = rows.Single(row => row.GetProperty("id").GetGuid() == data.Quiz.Id);
        Assert.Equal(2, active.GetProperty("assignedStudentCount").GetInt32());
        Assert.Equal(1, active.GetProperty("startedCount").GetInt32());
        Assert.Equal(1, active.GetProperty("finalizedCount").GetInt32());
        Assert.True(active.GetProperty("isLocked").GetBoolean());
        Assert.False(rows.Single(row => row.GetProperty("id").GetGuid() == draft.Id)
            .GetProperty("isPublished").GetBoolean());
    }

    [Fact]
    public async Task TeacherResults_IncludeBothClasses_AndAggregateOnlyFinalizedScores()
    {
        var data = await TestData.CreateAsync(factory);
        var now = factory.Clock.GetUtcNow().UtcDateTime;
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var firstStudent = await TestData.LoginAsync(factory, data.Student);
        using var secondStudent = await TestData.LoginAsync(factory, data.OtherClassStudent);
        var payload = Payload(data.ClassRoom.Id, now) with
        {
            ClassRoomIds = [data.ClassRoom.Id, data.OtherClassRoom.Id],
        };
        using var created = await teacher.PostAsJsonAsync("/api/teacher/quizzes", payload);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var quizId = (await JsonAsync(created)).GetProperty("id").GetGuid();
        var resultsUrl = $"/api/teacher/quizzes/{quizId}/results";
        using var published = await teacher.PostAsync($"/api/teacher/quizzes/{quizId}/publish", null);
        Assert.Equal(HttpStatusCode.OK, published.StatusCode);

        using var empty = await teacher.GetAsync(resultsUrl);
        var emptySummary = (await JsonAsync(empty)).GetProperty("summary");
        Assert.Equal(3, emptySummary.GetProperty("assignedCount").GetInt32());
        Assert.Equal(0, emptySummary.GetProperty("startedCount").GetInt32());
        Assert.Equal(JsonValueKind.Null, emptySummary.GetProperty("averageScore").ValueKind);
        Assert.Equal(JsonValueKind.Null, emptySummary.GetProperty("highestScore").ValueKind);

        using var firstStart = await firstStudent.PostAsync($"/api/student/quizzes/{quizId}/attempt", null);
        using var secondStart = await secondStudent.PostAsync($"/api/student/quizzes/{quizId}/attempt", null);
        var firstAttempt = await JsonAsync(firstStart);
        var secondAttempt = await JsonAsync(secondStart);
        Assert.Equal(HttpStatusCode.Created, firstStart.StatusCode);
        Assert.Equal(HttpStatusCode.Created, secondStart.StatusCode);
        using var running = await teacher.GetAsync(resultsUrl);
        var runningBody = await JsonAsync(running);
        Assert.Equal(2, runningBody.GetProperty("summary").GetProperty("startedCount").GetInt32());
        Assert.Equal(0, runningBody.GetProperty("summary").GetProperty("finalizedCount").GetInt32());
        Assert.Equal(2, runningBody.GetProperty("rows").EnumerateArray()
            .Count(row => row.GetProperty("status").GetString() == "InProgress"));

        async Task AnswerAndSubmit(HttpClient client, JsonElement attempt, int optionIndex)
        {
            var question = attempt.GetProperty("questions")[0];
            var url = $"/api/student/attempts/{attempt.GetProperty("id").GetGuid()}/answers/{question.GetProperty("id").GetGuid()}";
            using var answer = await client.PutAsJsonAsync(url,
                new { selectedOptionId = question.GetProperty("options")[optionIndex].GetProperty("id").GetGuid() });
            Assert.Equal(HttpStatusCode.OK, answer.StatusCode);
            using var submit = await client.PostAsync(
                $"/api/student/attempts/{attempt.GetProperty("id").GetGuid()}/submit", null);
            Assert.Equal(HttpStatusCode.OK, submit.StatusCode);
        }
        await AnswerAndSubmit(firstStudent, firstAttempt, 0);
        await AnswerAndSubmit(secondStudent, secondAttempt, 1);

        using var results = await teacher.GetAsync(resultsUrl);
        var summary = (await JsonAsync(results)).GetProperty("summary");
        Assert.Equal(3, summary.GetProperty("assignedCount").GetInt32());
        Assert.Equal(2, summary.GetProperty("finalizedCount").GetInt32());
        Assert.Equal(1.5m, summary.GetProperty("averageScore").GetDecimal());
        Assert.Equal(4m, summary.GetProperty("highestScore").GetDecimal());
        Assert.Equal(-1m, summary.GetProperty("lowestScore").GetDecimal());
        Assert.Equal(37.5m, summary.GetProperty("averagePercentage").GetDecimal());
    }

    [Fact]
    public async Task PublishAndUnpublishAreIdempotent_AndRepeatedFullUpdateKeepsOneSetOfQuestions()
    {
        var data = await TestData.CreateAsync(factory, published: false);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        var path = $"/api/teacher/quizzes/{data.Quiz.Id}";
        var payload = Payload(data.ClassRoom.Id, factory.Clock.GetUtcNow().UtcDateTime);
        using var firstUpdate = await teacher.PutAsJsonAsync(path, payload);
        using var secondUpdate = await teacher.PutAsJsonAsync(path, payload);
        Assert.Equal(HttpStatusCode.OK, firstUpdate.StatusCode);
        Assert.Equal(HttpStatusCode.OK, secondUpdate.StatusCode);
        Assert.Equal(1, (await JsonAsync(secondUpdate)).GetProperty("questions").GetArrayLength());
        using var publish = await teacher.PostAsync(path + "/publish", null);
        using var publishAgain = await teacher.PostAsync(path + "/publish", null);
        Assert.Equal(HttpStatusCode.OK, publish.StatusCode);
        Assert.True((await JsonAsync(publishAgain)).GetProperty("isPublished").GetBoolean());
        using var unpublish = await teacher.PostAsync(path + "/unpublish", null);
        using var unpublishAgain = await teacher.PostAsync(path + "/unpublish", null);
        Assert.Equal(HttpStatusCode.OK, unpublish.StatusCode);
        Assert.False((await JsonAsync(unpublishAgain)).GetProperty("isPublished").GetBoolean());
    }

    private async Task<User> AddTeacherAsync()
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var user = User.CreateTeacher($"other.{Guid.NewGuid():N}", "Other teacher", hasher.Hash(TestData.TeacherPassword));
        db.Users.Add(user);
        await db.SaveChangesAsync();
        return user;
    }

    private static QuizPayload Payload(Guid classId, DateTime now) =>
        new("Practice quiz", null, [classId], now.AddMinutes(-5), now.AddHours(1), 20, 25,
            [new QuestionPayload("Question?", 4, [new OptionPayload("Correct", true), new OptionPayload("Wrong", false)])]);

    private sealed record QuizPayload(string Title, string? Description, Guid[] ClassRoomIds,
        DateTime OpensAt, DateTime ClosesAt, int DurationMinutes, int WrongAnswerPenaltyPercent,
        QuestionPayload[] Questions);
    private sealed record QuestionPayload(string Text, int Points, OptionPayload[] Options);
    private sealed record OptionPayload(string Text, bool IsCorrect);

    private static async Task<string?> CodeAsync(HttpResponseMessage response) =>
        (await JsonAsync(response)).GetProperty("code").GetString();

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response) =>
        Parse(await response.Content.ReadAsStringAsync());

    private static JsonElement Parse(string content)
    {
        using var document = JsonDocument.Parse(content);
        return document.RootElement.Clone();
    }
}
