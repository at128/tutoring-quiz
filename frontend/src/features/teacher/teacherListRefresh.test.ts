import { describe, expect, it } from 'vitest'
import type { TeacherQuizSummary } from '../../api/types'
import { teacherListRefreshDelay } from './teacherListRefresh'

const NOW = Date.parse('2026-09-24T10:00:00Z')
const quiz = (state: TeacherQuizSummary['state'], opensAt: string, closesAt: string): TeacherQuizSummary => ({
  id: state, title: state, classRooms: [], opensAt, closesAt,
  durationMinutes: 20, wrongAnswerPenaltyPercent: 0, wrongAnswerPenaltyPoints: null, isPublished: state !== 'Draft',
  state, isLocked: false, questionCount: 1, maxScore: 4,
  assignedStudentCount: 2, startedCount: 0, finalizedCount: 0,
})

describe('teacher list refresh schedule', () => {
  it('refreshes just after an upcoming opening or an open quiz closing', () => {
    const scheduled = quiz('Scheduled', '2026-09-24T10:00:05Z', '2026-09-24T11:00:00Z')
    const open = quiz('Open', '2026-09-24T09:00:00Z', '2026-09-24T10:00:02Z')
    expect(teacherListRefreshDelay([scheduled, open], NOW)).toBe(2250)
    expect(teacherListRefreshDelay([scheduled], NOW)).toBe(5250)
  })

  it('uses a short retry at the exact boundary and a capped fallback otherwise', () => {
    const openingNow = quiz('Scheduled', '2026-09-24T10:00:00Z', '2026-09-24T11:00:00Z')
    const farAway = quiz('Scheduled', '2026-09-24T12:00:00Z', '2026-09-24T13:00:00Z')
    expect(teacherListRefreshDelay([openingNow], NOW)).toBe(1000)
    expect(teacherListRefreshDelay([farAway], NOW)).toBe(30_000)
    expect(teacherListRefreshDelay([quiz('Draft', farAway.opensAt, farAway.closesAt)], NOW)).toBe(30_000)
    expect(teacherListRefreshDelay([], NOW)).toBe(30_000)
    expect(teacherListRefreshDelay(undefined, NOW)).toBe(30_000)
  })

  it('does not infer a new state from a skewed device clock; the API remains authoritative', () => {
    const staleScheduled = quiz('Scheduled', '2026-09-24T09:59:00Z', '2026-09-24T11:00:00Z')
    expect(teacherListRefreshDelay([staleScheduled], NOW)).toBe(30_000)
    expect(staleScheduled.state).toBe('Scheduled')
  })
})
