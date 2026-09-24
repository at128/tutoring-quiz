import type { TeacherQuizSummary } from '../../api/types'

const MAX_REFRESH_MS = 30_000
const MIN_REFRESH_MS = 1_000
const BOUNDARY_MARGIN_MS = 250

/** Poll at the next opening/closing boundary, but never trust the device clock for the state itself. */
export function teacherListRefreshDelay(quizzes: TeacherQuizSummary[] | undefined, nowMs: number): number {
  const nextBoundary = quizzes?.reduce<number>((soonest, quiz) => {
    const time = quiz.state === 'Scheduled' ? quiz.opensAt : quiz.state === 'Open' ? quiz.closesAt : null
    if (time === null) return soonest
    const delay = Date.parse(time) - nowMs
    return delay >= 0 ? Math.min(soonest, delay + BOUNDARY_MARGIN_MS) : soonest
  }, MAX_REFRESH_MS) ?? MAX_REFRESH_MS

  return Math.max(MIN_REFRESH_MS, nextBoundary)
}
