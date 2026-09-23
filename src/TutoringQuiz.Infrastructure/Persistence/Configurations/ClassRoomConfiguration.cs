using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using TutoringQuiz.Domain.ClassRooms;

namespace TutoringQuiz.Infrastructure.Persistence.Configurations;

internal sealed class ClassRoomConfiguration : IEntityTypeConfiguration<ClassRoom>
{
    public void Configure(EntityTypeBuilder<ClassRoom> builder)
    {
        builder.ToTable("ClassRooms");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.Name).HasMaxLength(ClassRoom.NameMaxLength).IsRequired();
        builder.HasIndex(c => c.Name).IsUnique();
    }
}
