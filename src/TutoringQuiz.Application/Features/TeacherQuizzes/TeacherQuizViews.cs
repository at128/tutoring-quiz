using TutoringQuiz.Application.Common.Views;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Application.Features.TeacherQuizzes;

public sealed record TeacherQuizSummary(
    Guid Id, string Title, IReadOnlyList<ClassRoomRef> ClassRooms,
    DateTime OpensAt, DateTime ClosesAt, int DurationMinutes, int WrongAnswerPenaltyPercent, decimal? WrongAnswerPenaltyPoints,
    bool IsPublished, TeacherQuizState State, bool IsLocked,
    int QuestionCount, int MaxScore, int AssignedStudentCount, int StartedCount, int FinalizedCount);

public sealed record TeacherQuestionView(
    Guid Id, int Order, string Text, int Points, IReadOnlyList<TeacherOptionView> Options);

public sealed record TeacherOptionView(Guid Id, int Order, string Text, bool IsCorrect);

public sealed record QuizEditorView(
    Guid Id, string Title, string? Description, IReadOnlyList<ClassRoomRef> ClassRooms,
    DateTime OpensAt, DateTime ClosesAt, int DurationMinutes, int WrongAnswerPenaltyPercent, decimal? WrongAnswerPenaltyPoints,
    bool IsPublished, TeacherQuizState State, bool IsLocked, bool HasAttempts, bool ScoresVisibleToStudents, int MaxScore,
    IReadOnlyList<TeacherQuestionView> Questions);

/// <summary>Pure projections: no database or clock reads.</summary>
internal static class TeacherQuizViews
{
    /// <summary><c>IsLocked</c>: attempts exist and the quiz is still open. <c>HasAttempts</c> with <c>!IsLocked</c>: closed
    /// with attempts, so only content and marking can change, and saving regrades.</summary>
    public static QuizEditorView Editor(Quiz quiz, IReadOnlyDictionary<Guid, string> classNames,
        bool hasAttempts, DateTime nowUtc) =>
        new(quiz.Id, quiz.Title, quiz.Description, Classes(quiz, classNames),
            quiz.OpensAtUtc, quiz.ClosesAtUtc, quiz.DurationMinutes, quiz.WrongAnswerPenaltyPercent, quiz.WrongAnswerPenaltyPoints,
            quiz.IsPublished, quiz.StateAt(nowUtc), quiz.IsLockedAt(nowUtc, hasAttempts), hasAttempts,
            quiz.ScoresVisibleToStudents, quiz.MaxScore,
            quiz.Questions.OrderBy(q => q.Order)
                .Select(q => new TeacherQuestionView(q.Id, q.Order, q.Text, q.Points,
                    q.Options.OrderBy(o => o.Order)
                        .Select(o => new TeacherOptionView(o.Id, o.Order, o.Text, o.IsCorrect)).ToList()))
                .ToList());

    public static TeacherQuizSummary Summary(Quiz quiz, IReadOnlyDictionary<Guid, string> classNames,
        int assignedCount, int startedCount, int finalizedCount, DateTime nowUtc) =>
        new(quiz.Id, quiz.Title, Classes(quiz, classNames),
            quiz.OpensAtUtc, quiz.ClosesAtUtc, quiz.DurationMinutes, quiz.WrongAnswerPenaltyPercent, quiz.WrongAnswerPenaltyPoints,
            quiz.IsPublished, quiz.StateAt(nowUtc), quiz.IsLockedAt(nowUtc, startedCount > 0),
            quiz.Questions.Count, quiz.MaxScore, assignedCount, startedCount, finalizedCount);

    public static IReadOnlyList<ClassRoomRef> Classes(Quiz quiz, IReadOnlyDictionary<Guid, string> names) =>
        quiz.ClassRooms
            .Select(c => new ClassRoomRef(c.ClassRoomId, names[c.ClassRoomId]))
            .OrderBy(c => c.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
}
