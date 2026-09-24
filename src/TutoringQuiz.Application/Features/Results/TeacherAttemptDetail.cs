using TutoringQuiz.Domain.Attempts;
using TutoringQuiz.Domain.Quizzes;
using TutoringQuiz.Domain.Scoring;

namespace TutoringQuiz.Application.Features.Results;

public sealed record TeacherAttemptStudent(Guid Id, string FullName, string Username, string? ClassRoom);

public sealed record TeacherAnswerOption(Guid Id, int Order, string Text, bool IsCorrect);

/// <param name="SelectedOptionId">What the student chose, even when that option was later removed.</param>
/// <param name="RemovedSelectionText">The chosen option's text when the teacher removed it after the student chose it
/// (the answer then counts as unanswered).</param>
public sealed record TeacherAnswerLine(
    Guid QuestionId, int Order, string Text, int Points, IReadOnlyList<TeacherAnswerOption> Options,
    Guid? SelectedOptionId, string? RemovedSelectionText, AnswerOutcome Outcome,
    decimal Earned, decimal Deduction, decimal Contribution);

/// <summary>
/// One student's answers, question by question, scored by the quiz as it is now (the same <see cref="QuizScoring"/> the
/// stored result came from). <c>Score</c> is the stored result: <c>QuestionsTotal</c> kept at 0 or more.
/// </summary>
public sealed record TeacherAttemptDetail(
    Guid AttemptId, Guid QuizId, string QuizTitle, TeacherAttemptStudent Student,
    AttemptStatus Status, DateTime StartedAt, DateTime Deadline, DateTime? FinalizedAt, DateTime? RegradedAt,
    decimal? Score, int MaxScore, decimal? Percentage, int CorrectCount, int WrongCount, int UnansweredCount,
    decimal QuestionsTotal, int WrongAnswerPenaltyPercent, decimal? WrongAnswerPenaltyPoints, bool ScoresVisibleToStudents,
    IReadOnlyList<TeacherAnswerLine> Questions);

/// <summary>Pure projection of an attempt for its quiz's teacher (who may see everything, correct answers included).</summary>
internal static class TeacherAttemptViews
{
    public static TeacherAttemptDetail Detail(Quiz quiz, QuizAttempt attempt, TeacherAttemptStudent student)
    {
        var sheet = attempt.ScoreSheet(quiz);
        var lineByQuestion = sheet.Questions.ToDictionary(line => line.QuestionId);
        var questions = quiz.Questions.Select(question =>
            {
                var line = lineByQuestion[question.Id];
                var options = question.Options;
                var removedText = line.SelectedOptionId is { } selected && options.All(o => o.Id != selected)
                    ? question.FindOption(selected)?.Text
                    : null;
                return new TeacherAnswerLine(question.Id, question.Order, question.Text, question.Points,
                    options.Select(o => new TeacherAnswerOption(o.Id, o.Order, o.Text, o.IsCorrect)).ToList(),
                    line.SelectedOptionId, removedText, line.Outcome, line.Earned, line.Deduction, line.Contribution);
            })
            .ToList();

        // A finished attempt shows its stored result; every edit to a quiz with attempts regrades them, so it matches.
        var finished = attempt.IsFinalized;
        var counts = sheet.Breakdown;
        return new TeacherAttemptDetail(attempt.Id, quiz.Id, quiz.Title, student,
            attempt.Status, attempt.StartedAtUtc, attempt.DeadlineUtc, attempt.FinalizedAtUtc, attempt.RegradedAtUtc,
            finished ? attempt.Score : null,
            finished ? attempt.MaxScore : counts.MaxScore,
            finished ? attempt.Percentage : null,
            finished ? attempt.CorrectCount ?? counts.CorrectCount : counts.CorrectCount,
            finished ? attempt.WrongCount ?? counts.WrongCount : counts.WrongCount,
            finished ? attempt.UnansweredCount ?? counts.UnansweredCount : counts.UnansweredCount,
            sheet.QuestionsTotal, quiz.WrongAnswerPenaltyPercent, quiz.WrongAnswerPenaltyPoints, quiz.ScoresVisibleToStudents,
            questions);
    }
}
