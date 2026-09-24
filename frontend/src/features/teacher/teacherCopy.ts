import type { TeacherQuizState, TeacherQuizSummary } from '../../api/types'
import { formatRelative } from '../../lib/time'

// Pure wording for teacher screens (from the approved prototype).

/** "−25% per wrong" / "No negative marking" (table cell). */
export const markingShort = (penaltyPercent: number) =>
  penaltyPercent === 0 ? 'No negative marking' : `−${penaltyPercent}% per wrong`

/** "25% of the question’s points per wrong answer" / "None" (details). */
export const markingLong = (penaltyPercent: number) =>
  penaltyPercent === 0 ? 'None' : `${penaltyPercent}% of the question’s points per wrong answer`

export type Progress = { value: string | null; caption: string }

/** "10 of 40 finalized", "0 of 40 started", "— opens in 2 days", "— not visible to students". */
export function progressOf(quiz: TeacherQuizSummary, nowMs: number): Progress {
  switch (quiz.state) {
    case 'Draft':
      return { value: null, caption: 'not visible to students' }
    case 'Scheduled':
      return { value: null, caption: `opens ${formatRelative(quiz.opensAt, nowMs)}` }
    default:
      return quiz.startedCount > 0
        ? { value: `${quiz.finalizedCount} of ${quiz.assignedStudentCount}`, caption: 'finalized' }
        : { value: `0 of ${quiz.assignedStudentCount}`, caption: 'started' }
  }
}

/** Results only make sense once students could take it. */
export const hasResults = (state: TeacherQuizState) => state === 'Open' || state === 'Closed'

export const quizCount = (count: number) => `${count} quiz${count === 1 ? '' : 'zes'}`
