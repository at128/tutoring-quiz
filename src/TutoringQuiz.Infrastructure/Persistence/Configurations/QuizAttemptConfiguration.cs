using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.Quizzes;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Infrastructure.Persistence.Configurations;

internal sealed class QuizAttemptConfiguration : IEntityTypeConfiguration<QuizAttempt>
{
    public void Configure(EntityTypeBuilder<QuizAttempt> builder)
    {
        builder.ToTable("QuizAttempts");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Ignore(a => a.IsFinalized);
        builder.Ignore(a => a.Percentage);

        // A student can never have two attempts at the same quiz, however the requests race.
        builder.HasIndex(a => new { a.QuizId, a.StudentId }).IsUnique();
        builder.HasIndex(a => a.StudentId);

        builder.Property(a => a.Version).IsConcurrencyToken();

        builder.HasOne<Quiz>()
            .WithMany()
            .HasForeignKey(a => a.QuizId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(a => a.StudentId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(a => a.Answers)
            .WithOne()
            .HasForeignKey(answer => answer.AttemptId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(a => a.Answers).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class AttemptAnswerConfiguration : IEntityTypeConfiguration<AttemptAnswer>
{
    public void Configure(EntityTypeBuilder<AttemptAnswer> builder)
    {
        builder.ToTable("AttemptAnswers");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.HasIndex(a => new { a.AttemptId, a.QuestionId }).IsUnique();

        builder.HasOne<Question>()
            .WithMany()
            .HasForeignKey(a => a.QuestionId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasOne<Option>()
            .WithMany()
            .HasForeignKey(a => a.SelectedOptionId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
