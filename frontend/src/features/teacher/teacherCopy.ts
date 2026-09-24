import type { TeacherQuizState, TeacherQuizSummary } from '../../api/types'
import type { Messages } from '../../i18n/en'
import type { Lang } from '../../i18n/lang'
import { formatRelative } from '../../lib/time'

// Pure view logic for teacher screens; the words come from the dictionary (i18n/).

export type Progress = { value: string | null; caption: string }

/** "10 of 40 finalized", "0 of 40 started", "— opens in 2 days", "— not visible to students". */
export function progressOf(quiz: TeacherQuizSummary, nowMs: number, t: Messages, lang: Lang): Progress {
  const m = t.teacher
  switch (quiz.state) {
    case 'Draft':
      return { value: null, caption: m.notVisible }
    case 'Scheduled':
      return { value: null, caption: m.opensRelative(formatRelative(quiz.opensAt, nowMs, lang)) }
    default:
      return quiz.startedCount > 0
        ? { value: m.xOfY(quiz.finalizedCount, quiz.assignedStudentCount), caption: m.finalized }
        : { value: m.xOfY(0, quiz.assignedStudentCount), caption: m.started }
  }
}

/** Results only make sense once students could take it. */
export const hasResults = (state: TeacherQuizState) => state === 'Open' || state === 'Closed'
