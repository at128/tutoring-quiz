using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Unicode;

namespace TutoringQuiz.Api;

public static class JsonDefaults
{
    // camelCase (the web default), enums as strings, and Arabic written as-is instead of \u0627 escapes.
    public static void Apply(JsonSerializerOptions options)
    {
        options.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.Converters.Add(new JsonStringEnumConverter());
        options.Encoder = JavaScriptEncoder.Create(UnicodeRanges.All);
    }
}
