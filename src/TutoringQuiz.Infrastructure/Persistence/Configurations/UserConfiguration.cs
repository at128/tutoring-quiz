using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TutoringQuiz.Domain.ClassRooms;
using TutoringQuiz.Domain.Users;

namespace TutoringQuiz.Infrastructure.Persistence.Configurations;

internal sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");
        builder.HasKey(u => u.Id);
        builder.Property(u => u.Id).ValueGeneratedNever();
        builder.Property(u => u.Username).HasMaxLength(User.UsernameMaxLength).IsRequired();
        builder.Property(u => u.UsernameNormalized).HasMaxLength(User.UsernameMaxLength).IsRequired();
        builder.HasIndex(u => u.UsernameNormalized).IsUnique();
        builder.Property(u => u.FullName).HasMaxLength(User.FullNameMaxLength).IsRequired();
        builder.Property(u => u.PasswordHash).HasMaxLength(500).IsRequired();

        builder.HasOne<ClassRoom>()
            .WithMany()
            .HasForeignKey(u => u.ClassRoomId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
