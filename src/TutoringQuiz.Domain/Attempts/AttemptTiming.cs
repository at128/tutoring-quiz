namespace TutoringQuiz.Domain.Attempts;

public static class AttemptTiming
{
    /// <summary>DeadlineUtc = min(start + duration, quiz close).</summary>
    public static DateTime Deadline(DateTime startedAtUtc, int durationMinutes, DateTime closesAtUtc)
    {
        // Compare before adding so an extreme valid close date near DateTime.MaxValue cannot overflow.
        var duration = TimeSpan.FromMinutes(durationMinutes);
        return closesAtUtc - startedAtUtc <= duration ? closesAtUtc : startedAtUtc.Add(duration);
    }

    /// <summary>No grace after the deadline: an answer counts only when saved at or before it.</summary>
    public static bool CanSaveAnswer(DateTime nowUtc, DateTime deadlineUtc) => nowUtc <= deadlineUtc;

    public static bool IsPastDeadline(DateTime nowUtc, DateTime deadlineUtc) => nowUtc > deadlineUtc;

    /// <summary>Whole minutes a student would get by starting now: min(duration, minutes until close), rounded down.</summary>
    public static int EffectiveMinutesIfStartedNow(DateTime nowUtc, int durationMinutes, DateTime closesAtUtc) =>
        Math.Max(0, (int)Math.Floor((Deadline(nowUtc, durationMinutes, closesAtUtc) - nowUtc).TotalMinutes));
}
