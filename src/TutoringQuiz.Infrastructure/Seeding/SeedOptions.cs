using Microsoft.Extensions.Configuration;

namespace TutoringQuiz.Infrastructure.Seeding;

/// <summary>The <c>Seed</c> configuration section. Passwords are demo credentials printed in the README.</summary>
public sealed record SeedOptions(bool Enabled, string Path, string StudentPassword, string TeacherPassword)
{
    public const string DefaultStudentPassword = "Student@2026";
    public const string DefaultTeacherPassword = "Teacher@2026";

    public static SeedOptions From(IConfiguration configuration)
    {
        var section = configuration.GetSection("Seed");
        return new SeedOptions(
            Enabled: bool.TryParse(section["Enabled"], out var enabled) && enabled,
            Path: NonEmpty(section["Path"]) ?? System.IO.Path.Combine(AppContext.BaseDirectory, "seed"),
            StudentPassword: NonEmpty(section["StudentPassword"]) ?? DefaultStudentPassword,
            TeacherPassword: NonEmpty(section["TeacherPassword"]) ?? DefaultTeacherPassword);
    }

    private static string? NonEmpty(string? value) => string.IsNullOrWhiteSpace(value) ? null : value;
}
