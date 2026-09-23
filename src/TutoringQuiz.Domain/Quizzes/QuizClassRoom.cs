namespace TutoringQuiz.Domain.Quizzes;

/// <summary>A class a quiz is assigned to (a quiz can go to several classes of the same grade).</summary>
public sealed class QuizClassRoom
{
    private QuizClassRoom() { }

    internal QuizClassRoom(Guid quizId, Guid classRoomId)
    {
        QuizId = quizId;
        ClassRoomId = classRoomId;
    }

    public Guid QuizId { get; private set; }
    public Guid ClassRoomId { get; private set; }
}
