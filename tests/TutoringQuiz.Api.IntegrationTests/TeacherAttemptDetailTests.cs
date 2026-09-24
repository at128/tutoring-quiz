using System.Net;
using System.Text.Json;
using TutoringQuiz.Api.IntegrationTests.Infrastructure;

namespace TutoringQuiz.Api.IntegrationTests;

public sealed class TeacherAttemptDetailTests(TestAppFactory factory) : IClassFixture<TestAppFactory>
{
    [Fact]
    public async Task DetailExplainsEveryAnswer_AndMatchesTeacherRowAndStudentResult()
    {
        var data = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        var attempt = await RegradeHttp.StartAsync(student, data.Quiz.Id);
        await RegradeHttp.AnswerAsync(student, attempt, 0, 0);
        await RegradeHttp.AnswerAsync(student, attempt, 1, 1);
        var result = await RegradeHttp.SubmitAsync(student, attempt);
        var detail = await RegradeHttp.DetailAsync(teacher, data.Quiz.Id, attempt);
        using var resultsResponse = await teacher.GetAsync($"/api/teacher/quizzes/{data.Quiz.Id}/results");
        var results = await RegradeHttp.JsonAsync(resultsResponse);
        var row = results.GetProperty("rows").EnumerateArray()
            .Single(r => r.GetProperty("attemptId").ValueKind != JsonValueKind.Null &&
                         r.GetProperty("attemptId").GetGuid() == attempt.GetProperty("id").GetGuid());

        Assert.Equal(attempt.GetProperty("id").GetGuid(), detail.GetProperty("attemptId").GetGuid());
        Assert.Equal(data.Quiz.Id, detail.GetProperty("quizId").GetGuid());
        Assert.Equal(data.Student.Id, detail.GetProperty("student").GetProperty("id").GetGuid());
        Assert.Equal(data.Student.Username, detail.GetProperty("student").GetProperty("username").GetString());
        Assert.Equal(data.Student.FullName, detail.GetProperty("student").GetProperty("fullName").GetString());
        Assert.Equal(data.ClassRoom.Name, detail.GetProperty("student").GetProperty("classRoom").GetString());
        Assert.Equal("Submitted", detail.GetProperty("status").GetString());
        Assert.Equal(attempt.GetProperty("startedAt").GetString(), detail.GetProperty("startedAt").GetString());
        Assert.Equal(attempt.GetProperty("deadline").GetString(), detail.GetProperty("deadline").GetString());
        Assert.Equal(25, detail.GetProperty("wrongAnswerPenaltyPercent").GetInt32());
        Assert.Equal(9, detail.GetProperty("maxScore").GetInt32());
        Assert.Equal(4, detail.GetProperty("questions").GetArrayLength());
        var correct = detail.GetProperty("questions")[0];
        var wrong = detail.GetProperty("questions")[1];
        Assert.Equal(attempt.GetProperty("questions")[0].GetProperty("options")[0].GetProperty("id").GetGuid(),
            correct.GetProperty("selectedOptionId").GetGuid());
        Assert.Equal("Correct", correct.GetProperty("outcome").GetString());
        Assert.Equal(4m, correct.GetProperty("earned").GetDecimal());
        Assert.Equal(0m, correct.GetProperty("deduction").GetDecimal());
        Assert.Equal(4m, correct.GetProperty("contribution").GetDecimal());
        Assert.True(correct.GetProperty("options")[0].GetProperty("isCorrect").GetBoolean());
        Assert.Equal("Wrong", wrong.GetProperty("outcome").GetString());
        Assert.Equal(0m, wrong.GetProperty("earned").GetDecimal());
        Assert.Equal(.5m, wrong.GetProperty("deduction").GetDecimal());
        Assert.Equal(-.5m, wrong.GetProperty("contribution").GetDecimal());
        Assert.Equal("Unanswered", detail.GetProperty("questions")[2].GetProperty("outcome").GetString());
        var contributions = detail.GetProperty("questions").EnumerateArray().Sum(q => q.GetProperty("contribution").GetDecimal());
        Assert.Equal(contributions, detail.GetProperty("questionsTotal").GetDecimal());
        Assert.Equal(Math.Max(0m, contributions), detail.GetProperty("score").GetDecimal());
        Assert.Equal(result.GetProperty("score").GetDecimal(), detail.GetProperty("score").GetDecimal());
        Assert.Equal(row.GetProperty("score").GetDecimal(), detail.GetProperty("score").GetDecimal());
        Assert.Equal(result.GetProperty("percentage").GetDecimal(), detail.GetProperty("percentage").GetDecimal());
        Assert.Equal(row.GetProperty("percentage").GetDecimal(), detail.GetProperty("percentage").GetDecimal());
        Assert.Equal(1, detail.GetProperty("correctCount").GetInt32());
        Assert.Equal(1, detail.GetProperty("wrongCount").GetInt32());
        Assert.Equal(2, detail.GetProperty("unansweredCount").GetInt32());
    }

    [Fact]
    public async Task OtherTeacherOtherQuizAndStudent_CannotReadAnAttemptDetail()
    {
        var data = await TestData.CreateAsync(factory);
        var other = await TestData.CreateAsync(factory);
        using var teacher = await TestData.LoginAsync(factory, data.Teacher);
        using var outsider = await TestData.LoginAsync(factory, other.Teacher);
        using var student = await TestData.LoginAsync(factory, data.Student);
        var attempt = await RegradeHttp.StartAsync(student, data.Quiz.Id);
        var id = attempt.GetProperty("id").GetGuid();
        var truePath = $"/api/teacher/quizzes/{data.Quiz.Id}/attempts/{id}";
        var wrongQuizPath = $"/api/teacher/quizzes/{data.OtherClassQuiz.Id}/attempts/{id}";
        using var notOwner = await outsider.GetAsync(truePath);
        using var wrongQuiz = await teacher.GetAsync(wrongQuizPath);
        using var wrongRole = await student.GetAsync(truePath);
        Assert.Equal(HttpStatusCode.NotFound, notOwner.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, wrongQuiz.StatusCode);
        Assert.Equal("not_found", (await RegradeHttp.JsonAsync(notOwner)).GetProperty("code").GetString());
        Assert.Equal("not_found", (await RegradeHttp.JsonAsync(wrongQuiz)).GetProperty("code").GetString());
        Assert.Equal(HttpStatusCode.Forbidden, wrongRole.StatusCode);
    }
}
