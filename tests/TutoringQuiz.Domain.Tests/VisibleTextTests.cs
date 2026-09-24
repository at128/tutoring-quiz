using TutoringQuiz.Domain.Common;
using TutoringQuiz.Domain.Quizzes;

namespace TutoringQuiz.Domain.Tests;

/// <summary>Text that shows nothing counts as empty; the editor's <c>isBlank</c> uses the same character classes.</summary>
public sealed class VisibleTextTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   \t\r\n")]
    [InlineData("\u00a0\u2003\u3000")] // NBSP, em space, ideographic space
    [InlineData("\u2028\u2029")] // line and paragraph separators
    [InlineData("\u0640\u0640\u0640")] // tatweel only
    [InlineData("\u0640\u064e\u0640\u0650\u0640\u0651")] // tatweel with diacritics
    [InlineData("\u064b\u0652\u0670")] // diacritics alone
    [InlineData("\u200c\u00a0")] // ZWNJ + NBSP
    [InlineData("\u200f")] // RLM
    [InlineData("\u200e\u202b\u202c\u2066\u2069\ufeff")] // direction marks, embedding, isolates, BOM
    [InlineData("\u0001\u0007")] // control characters
    [InlineData("\u20dd")] // an enclosing mark
    public void TextThatShowsNothing_IsBlank(string? value) => Assert.True(VisibleText.IsBlank(value));

    [Theory]
    [InlineData("؟")] // Arabic question mark
    [InlineData("٣")] // Arabic-Indic digit
    [InlineData("3")]
    [InlineData("عـــربي")] // a word stretched with tatweel
    [InlineData("ـبـ")]
    [InlineData("\u200fنعم")]
    [InlineData(".")]
    [InlineData("😀")] // outside the BMP: a surrogate pair
    [InlineData("\u0301a")] // a mark before a letter
    public void TextWithAnythingVisible_IsNotBlank(string value) => Assert.False(VisibleText.IsBlank(value));

    [Theory]
    [InlineData("\u0640\u0640\u0640")]
    [InlineData("\u0640\u064e\u0640\u0650")]
    [InlineData("\u200c\u00a0\u200c")]
    [InlineData("\u200f\u200f\u200f")]
    public void BlankTitleQuestionAndOption_GetTheSameErrorsAsEmptyOnes(string blank)
    {
        var errors = Validate(blank);
        var empty = Validate("");

        Assert.Equal(["questions[0].options[0].text", "questions[0].text", "title"], errors.Keys.Order(StringComparer.Ordinal));
        foreach (var key in errors.Keys) Assert.Equal(empty[key], errors[key]);
    }

    [Fact]
    public void ArabicWithTatweelAndDiacritics_IsValidContent()
    {
        var errors = QuizRules.Validate(
            new QuizDetails("اختبـــار الـنَّحو", null, TestQuizzes.Opens, TestQuizzes.Closes, 20, 25),
            [Guid.NewGuid()],
            [new QuestionDraft("مـا إعرابُ «كِتابٌ»؟", 1, [new OptionDraft("مبتـدأ", true), new OptionDraft("٣", false)])]);

        Assert.Empty(errors);
    }

    private static Dictionary<string, string[]> Validate(string text) => QuizRules.Validate(
        new QuizDetails(text, null, TestQuizzes.Opens, TestQuizzes.Closes, 20, 25),
        [Guid.NewGuid()],
        [new QuestionDraft(text, 1, [new OptionDraft(text, true), new OptionDraft("لا", false)])]);
}
