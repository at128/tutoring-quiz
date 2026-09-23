using System.Globalization;

namespace TutoringQuiz.Domain.Common;

internal static class UtcFormat
{
    public static string Iso(DateTime utc) =>
        utc.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
}
