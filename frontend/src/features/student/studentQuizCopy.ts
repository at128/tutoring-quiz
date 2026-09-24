import type { StudentQuizCard, StudentQuizStatus } from '../../api/types'
import { roundAwayFromZero } from '../../lib/format'

// Pure view logic shared by the student's quiz list and start screen (wording from the approved prototype).

export const groupTitles: Record<StudentQuizStatus, string> = {
  InProgress: 'In progress',
  Available: 'Available',
  Upcoming: 'Upcoming',
  Completed: 'Completed',
  Missed: 'Missed',
}

/** Groups in API order; empty groups are left out. */
export function groupByStatus(quizzes: StudentQuizCard[]): { status: StudentQuizStatus; quizzes: StudentQuizCard[] }[] {
  const groups = new Map<StudentQuizStatus, StudentQuizCard[]>()
  for (const quiz of quizzes) groups.set(quiz.status, [...(groups.get(quiz.status) ?? []), quiz])
  return [...groups].map(([status, items]) => ({ status, quizzes: items }))
}

/** One line under the facts row on a card. */
export const markingLine = (penaltyPercent: number) =>
  penaltyPercent === 0 ? 'No negative marking' : `Negative marking: a wrong answer costs ${penaltyPercent}% of its points`

/** Starting now would give less than the full time limit because the quiz closes first. */
export const isShortOnTime = (quiz: StudentQuizCard) =>
  quiz.status === 'Available' &&
  quiz.effectiveMinutesIfStartedNow !== null &&
  quiz.effectiveMinutesIfStartedNow < quiz.durationMinutes

/** Percentage for display only (the score itself comes from the server). */
export const displayPercentage = (score: number, maxScore: number) =>
  maxScore === 0 ? 0 : roundAwayFromZero((score / maxScore) * 100, 1)
