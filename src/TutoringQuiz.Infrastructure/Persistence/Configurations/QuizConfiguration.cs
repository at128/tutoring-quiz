using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TutoringQuiz.Domain.ClassRooms;
using TutoringQuiz.Domain.Quizzes;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Infrastructure.Persistence.Configurations;

internal sealed class QuizConfiguration : IEntityTypeConfiguration<Quiz>
{
    public void Configure(EntityTypeBuilder<Quiz> builder)
    {
        builder.ToTable("Quizzes");
        builder.HasKey(q => q.Id);
        builder.Property(q => q.Id).ValueGeneratedNever();
        builder.Property(q => q.Title).HasMaxLength(QuizRules.TitleMaxLength).IsRequired();
        builder.Property(q => q.Description).HasMaxLength(QuizRules.DescriptionMaxLength);
        builder.Ignore(q => q.MaxScore);

        builder.HasOne<User>()
            .WithMany()
            .HasForeignKey(q => q.TeacherId)
            .OnDelete(DeleteBehavior.Restrict);
        builder.HasIndex(q => q.TeacherId);

        builder.HasMany(q => q.Questions)
            .WithOne()
            .HasForeignKey(question => question.QuizId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(q => q.Questions).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasMany(q => q.ClassRooms)
            .WithOne()
            .HasForeignKey(c => c.QuizId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(q => q.ClassRooms).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class QuizClassRoomConfiguration : IEntityTypeConfiguration<QuizClassRoom>
{
    public void Configure(EntityTypeBuilder<QuizClassRoom> builder)
    {
        builder.ToTable("QuizClassRooms");
        builder.HasKey(c => new { c.QuizId, c.ClassRoomId });

        builder.HasOne<ClassRoom>()
            .WithMany()
            .HasForeignKey(c => c.ClassRoomId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}

internal sealed class QuestionConfiguration : IEntityTypeConfiguration<Question>
{
    public void Configure(EntityTypeBuilder<Question> builder)
    {
        builder.ToTable("Questions");
        builder.HasKey(q => q.Id);
        builder.Property(q => q.Id).ValueGeneratedNever();
        builder.Property(q => q.Text).HasMaxLength(QuizRules.QuestionTextMaxLength).IsRequired();
        builder.Ignore(q => q.CorrectOptionId);
        builder.HasIndex(q => new { q.QuizId, q.Order });

        builder.HasMany(q => q.Options)
            .WithOne()
            .HasForeignKey(o => o.QuestionId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(q => q.Options).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

internal sealed class OptionConfiguration : IEntityTypeConfiguration<Option>
{
    public void Configure(EntityTypeBuilder<Option> builder)
    {
        builder.ToTable("Options");
        builder.HasKey(o => o.Id);
        builder.Property(o => o.Id).ValueGeneratedNever();
        builder.Property(o => o.Text).HasMaxLength(QuizRules.OptionTextMaxLength).IsRequired();
        builder.HasIndex(o => new { o.QuestionId, o.Order });
    }
}
