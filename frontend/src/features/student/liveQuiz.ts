import type { StudentQuizCard } from '../../api/types'

/** The API reports whole minutes, so zero can still mean a short but valid start window. */
export function availableTimeText(wholeMinutes: number | null): string {
  if (wholeMinutes === null) return ''
  if (wholeMinutes === 0) return 'less than 1 minute'
  return `${wholeMinutes} ${wholeMinutes === 1 ? 'minute' : 'minutes'}`
}

/** The approved warning, "You'll have only 8 minutes", without claiming "only 0 minutes" in the last minute. */
export const shortTimeWarning = (wholeMinutes: number | null): string =>
  wholeMinutes === 0 ? availableTimeText(0) : `only ${availableTimeText(wholeMinutes)}`

/** Keep time-derived availability current between server refreshes; the server still authorizes a start. */
export function liveQuiz(quiz: StudentQuizCard, nowMs: number): StudentQuizCard {
  if (quiz.status !== 'Upcoming' && quiz.status !== 'Available') return quiz

  const closesAt = Date.parse(quiz.closesAt)
  if (nowMs >= closesAt)
    return { ...quiz, status: 'Missed', effectiveMinutesIfStartedNow: null }

  if (nowMs < Date.parse(quiz.opensAt)) return quiz

  return {
    ...quiz,
    status: 'Available',
    effectiveMinutesIfStartedNow: Math.max(0, Math.min(quiz.durationMinutes, Math.floor((closesAt - nowMs) / 60_000))),
  }
}

const statusOrder: Record<StudentQuizCard['status'], number> = {
  InProgress: 0, Available: 1, Upcoming: 2, Completed: 3, Missed: 4,
}

/** Reapply the API's group order after a card changes status locally. */
export function liveQuizList(quizzes: StudentQuizCard[], nowMs: number): StudentQuizCard[] {
  return quizzes.map((quiz, index) => ({ quiz: liveQuiz(quiz, nowMs), index }))
    .sort((a, b) => {
      const group = statusOrder[a.quiz.status] - statusOrder[b.quiz.status]
      if (group !== 0) return group
      const first = a.quiz
      const second = b.quiz
      const byTime = first.status === 'InProgress'
        ? Date.parse(first.attempt?.deadline ?? first.closesAt) - Date.parse(second.attempt?.deadline ?? second.closesAt)
        : first.status === 'Available'
          ? Date.parse(first.closesAt) - Date.parse(second.closesAt)
          : first.status === 'Upcoming'
            ? Date.parse(first.opensAt) - Date.parse(second.opensAt)
            : first.status === 'Missed'
              ? Date.parse(second.closesAt) - Date.parse(first.closesAt)
              : 0
      return byTime || a.index - b.index
    })
    .map((entry) => entry.quiz)
}
