using TutoringQuiz.Domain.Common;

namespace TutoringQuiz.Domain.ClassRooms;

public sealed class ClassRoom : Entity
{
    public const int NameMaxLength = 20;

    private ClassRoom() { }

    public ClassRoom(string name, int grade)
    {
        name = name.Trim();
        if (name.Length is 0 or > NameMaxLength)
            throw new DomainException(ErrorCodes.ValidationFailed, $"Class name must be 1–{NameMaxLength} characters.");
        Name = name;
        Grade = grade;
    }

    public string Name { get; private set; } = null!;
    public int Grade { get; private set; }
}
