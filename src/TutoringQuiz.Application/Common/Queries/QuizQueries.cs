using Microsoft.EntityFrameworkCore;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Application.Common.Queries;

public static class QuizQueries
{
    /// <summary>Quiz with its classes and its questions/options in the teacher's order.</summary>
    public static IQueryable<Quiz> WithContent(this IQueryable<Quiz> quizzes) =>
        quizzes
            .Include(q => q.ClassRooms)
            .Include(q => q.Questions.OrderBy(question => question.Order))
            .ThenInclude(question => question.Options.OrderBy(option => option.Order));

    /// <summary>What a student may see at all: published and assigned to their class.</summary>
    public static IQueryable<Quiz> VisibleToClass(this IQueryable<Quiz> quizzes, Guid classRoomId) =>
        quizzes.Where(q => q.IsPublished && q.ClassRooms.Any(c => c.ClassRoomId == classRoomId));
}
