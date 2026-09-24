using System.Globalization;
using System.Text;

namespace TutoringQuiz.Domain.Common;

/// <summary>
/// Blank text shows nothing on screen: it has only spaces, control and format characters (ZWNJ, RLM…), combining
/// marks (Arabic diacritics) and tatweel (ـ). The quiz editor applies the same rule (frontend <c>editorForm.ts</c>).
/// </summary>
public static class VisibleText
{
    private const int Tatweel = 0x0640;

    public static bool IsBlank(string? value)
    {
        if (value is null) return true;
        foreach (var rune in value.EnumerateRunes())
            if (!IsIgnorable(rune)) return false;
        return true;
    }

    private static bool IsIgnorable(Rune rune) => rune.Value == Tatweel || Rune.GetUnicodeCategory(rune) is
        UnicodeCategory.SpaceSeparator or UnicodeCategory.LineSeparator or UnicodeCategory.ParagraphSeparator or
        UnicodeCategory.Control or UnicodeCategory.Format or
        UnicodeCategory.NonSpacingMark or UnicodeCategory.SpacingCombiningMark or UnicodeCategory.EnclosingMark;
}
