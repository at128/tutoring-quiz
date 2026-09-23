import type { StudentQuizCard, StudentQuizStatus } from '../../api/types'
import { formatDateTime, formatRelative, formatTime } from '../../lib/time'

// Pure view logic for a student's quiz card: group titles, hints and actions.

export const groupTitles: Record<StudentQuizStatus, string> = {
  InProgress: 'In progress',
  Available: 'Available now',
  Upcoming: 'Coming up',
  Completed: 'Completed',
  Missed: 'Missed',
}

/** Groups in API order; empty groups are left out. */
export function groupByStatus(quizzes: StudentQuizCard[]): { status: StudentQuizStatus; quizzes: StudentQuizCard[] }[] {
  const groups = new Map<StudentQuizStatus, StudentQuizCard[]>()
  for (const quiz of quizzes) groups.set(quiz.status, [...(groups.get(quiz.status) ?? []), quiz])
  return [...groups].map(([status, items]) => ({ status, quizzes: items }))
}

/** One line about time for the card. */
export function timeHint(quiz: StudentQuizCard, nowMs: number): string {
  switch (quiz.status) {
    case 'Available':
      return `Closes ${formatRelative(quiz.closesAt, nowMs)} · ${formatDateTime(quiz.closesAt)}`
    case 'Upcoming':
      return `Opens ${formatRelative(quiz.opensAt, nowMs)} · ${formatDateTime(quiz.opensAt)}`
    case 'InProgress':
      return quiz.attempt ? `Your time runs until ${formatTime(quiz.attempt.deadline)}` : ''
    case 'Completed':
      return quiz.attempt?.status === 'Expired'
        ? 'Time ran out — your saved answers were submitted automatically.'
        : 'Submitted'
    case 'Missed':
      return `Closed ${formatDateTime(quiz.closesAt)} — you didn't take it.`
  }
}

/** Starting now would give less than the full time limit because the quiz closes first. */
export const isShortOnTime = (quiz: StudentQuizCard) =>
  quiz.status === 'Available' &&
  quiz.effectiveMinutesIfStartedNow !== null &&
  quiz.effectiveMinutesIfStartedNow < quiz.durationMinutes

export const shortTimeMessage = (quiz: StudentQuizCard) =>
  `You'll have only ${quiz.effectiveMinutesIfStartedNow} minute${quiz.effectiveMinutesIfStartedNow === 1 ? '' : 's'} — the quiz closes at ${formatTime(quiz.closesAt)}.`

export type CardAction = { label: string; to: string; variant: 'primary' | 'secondary' } | null

export function cardAction(quiz: StudentQuizCard): CardAction {
  switch (quiz.status) {
    case 'Available':
      return { label: 'Open quiz', to: `/student/quizzes/${quiz.id}`, variant: 'primary' }
    case 'InProgress':
      return quiz.attempt ? { label: 'Resume quiz', to: `/student/attempts/${quiz.attempt.id}`, variant: 'primary' } : null
    case 'Upcoming':
      return { label: 'See details', to: `/student/quizzes/${quiz.id}`, variant: 'secondary' }
    case 'Completed':
      return quiz.attempt
        ? { label: 'View result', to: `/student/attempts/${quiz.attempt.id}/result`, variant: 'secondary' }
        : null
    case 'Missed':
      return null
  }
}
