using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace TutoringQuiz.Infrastructure.Persistence.Converters;

/// <summary>Stores UTC and reads values back as <see cref="DateTimeKind.Utc"/> (SQLite keeps no kind).</summary>
public sealed class UtcDateTimeConverter() : ValueConverter<DateTime, DateTime>(
    value => value.Kind == DateTimeKind.Utc ? value : value.ToUniversalTime(),
    value => DateTime.SpecifyKind(value, DateTimeKind.Utc));
