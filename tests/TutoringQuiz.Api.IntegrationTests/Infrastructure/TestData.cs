using System.Net;
using System.Net.Http.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using TutoringQuiz.Application.Common.Abstractions;
using TutoringQuiz.Domain.ClassRooms;
using TutoringQuiz.Domain.Quizzes;
using TutoringQuiz.Domain.Users;
using TutoringQuiz.Infrastructure.Persistence;

namespace TutoringQuiz.Api.IntegrationTests.Infrastructure;

internal sealed record TestScenario(
    Quiz Quiz, Quiz OtherClassQuiz, User Student, User SecondStudent, User OtherClassStudent,
    User Teacher, ClassRoom ClassRoom, ClassRoom OtherClassRoom);

/// <summary>Each test gets new users and quizzes in the fixture's real SQLite file.</summary>
internal static class TestData
{
    public const string StudentPassword = "Student@Test1";
    public const string TeacherPassword = "Teacher@Test1";

    public static async Task<TestScenario> CreateAsync(
        TestAppFactory factory, DateTime? opensAt = null, DateTime? closesAt = null,
        bool published = true, int penaltyPercent = 25)
    {
        var now = factory.Clock.GetUtcNow().UtcDateTime;
        var suffix = Guid.NewGuid().ToString("N")[..8];
        var classRoom = new ClassRoom($"T{suffix}", 10);
        var otherClassRoom = new ClassRoom($"U{suffix}", 11);
        var opens = opensAt ?? now.AddMinutes(-5);
        var closes = closesAt ?? now.AddHours(1);

        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        Assert.Equal(factory.ConnectionString, db.Database.GetConnectionString());
        var hasher = scope.ServiceProvider.GetRequiredService<IPasswordHasher>();
        var studentHash = hasher.Hash(StudentPassword);
        var teacherHash = hasher.Hash(TeacherPassword);
        var teacher = User.CreateTeacher($"teacher.{suffix}", "Test teacher", teacherHash);
        var student = User.CreateStudent($"student.{suffix}", "طالب تجريبي", classRoom.Id, studentHash);
        var secondStudent = User.CreateStudent($"second.{suffix}", "Second student", classRoom.Id, studentHash);
        var otherClassStudent = User.CreateStudent($"outside.{suffix}", "Other class", otherClassRoom.Id, studentHash);

        var questions = new[] { 4, 2, 2, 1 }.Select((points, index) =>
            new QuestionDraft($"Question {index + 1}", points,
            [new OptionDraft("Correct", true), new OptionDraft("Wrong A", false), new OptionDraft("Wrong B", false)])).ToList();
        var quiz = Quiz.Create(teacher.Id,
            new QuizDetails("HTTP test quiz", null, opens, closes, 20, penaltyPercent),
            [classRoom.Id], questions, opens.AddDays(-1));
        if (published) quiz.Publish(opens.AddDays(-1));

        var otherQuiz = Quiz.Create(teacher.Id,
            new QuizDetails("Other class quiz", null, opens, closes, 20, penaltyPercent),
            [otherClassRoom.Id], [questions[0]], opens.AddDays(-1));
        otherQuiz.Publish(opens.AddDays(-1));

        db.ClassRooms.AddRange(classRoom, otherClassRoom);
        db.Users.AddRange(teacher, student, secondStudent, otherClassStudent);
        db.Quizzes.AddRange(quiz, otherQuiz);
        await db.SaveChangesAsync();
        return new TestScenario(quiz, otherQuiz, student, secondStudent, otherClassStudent,
            teacher, classRoom, otherClassRoom);
    }

    public static async Task<HttpClient> LoginAsync(TestAppFactory factory, User user)
    {
        var client = factory.CreateClient();
        var password = user.Role == UserRole.Teacher ? TeacherPassword : StudentPassword;
        var response = await client.PostAsJsonAsync("/api/auth/login", new { username = user.Username, password });
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        return client;
    }
}
