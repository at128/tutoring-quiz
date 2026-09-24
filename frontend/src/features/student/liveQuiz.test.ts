import { describe, expect, it } from 'vitest'
import type { StudentQuizCard } from '../../api/types'
import { ar } from '../../i18n/ar'
import { stripIsolates } from '../../i18n/bidi'
import { en } from '../../i18n/en'
import { liveQuiz, liveQuizList } from './liveQuiz'

const opensAt = '2026-09-24T10:00:00Z'
const closesAt = '2026-09-24T10:08:00Z'
const card = (status: StudentQuizCard['status']): StudentQuizCard => ({
  id: 'quiz', title: 'Quiz', description: null, teacherName: 'Teacher', opensAt, closesAt,
  durationMinutes: 20, questionCount: 1, maxScore: 4, wrongAnswerPenaltyPercent: 25, wrongAnswerPenaltyPoints: null,
  status, effectiveMinutesIfStartedNow: null, attempt: null,
})

describe('liveQuiz', () => {
  it('does not call a still-open sub-minute window zero usable minutes, in either language', () => {
    expect(en.student.minutes(0)).toBe('less than 1 minute')
    expect(en.student.minutes(1)).toBe('1 minute')
    expect(en.student.minutes(8)).toBe('8 minutes')
    expect(en.student.onlyMinutes(8)).toBe('only 8 minutes')
    expect(en.student.onlyMinutes(1)).toBe('only 1 minute')
    expect(en.student.onlyMinutes(0)).toBe('less than 1 minute')

    expect(stripIsolates(ar.student.onlyMinutes(0))).toBe('أقل من دقيقة')
    expect(ar.student.onlyMinutes(1)).toBe('دقيقة واحدة فقط')
    expect(ar.student.onlyMinutes(2)).toBe('دقيقتان فقط')
    expect(ar.student.onlyMinutes(8)).toBe('8 دقائق فقط')
    expect(ar.student.onlyMinutes(15)).toBe('15 دقيقة فقط')
  })

  it('opens at the exact opening instant and closes at the exact closing instant', () => {
    const upcoming = card('Upcoming')
    expect(liveQuiz(upcoming, Date.parse(opensAt) - 1).status).toBe('Upcoming')
    expect(liveQuiz(upcoming, Date.parse(opensAt))).toMatchObject({
      status: 'Available', effectiveMinutesIfStartedNow: 8,
    })
    expect(liveQuiz(upcoming, Date.parse(closesAt))).toMatchObject({
      status: 'Missed', effectiveMinutesIfStartedNow: null,
    })
  })

  it('updates the remaining whole minutes while available, including less than one minute', () => {
    const available = card('Available')
    expect(liveQuiz(available, Date.parse(opensAt) + 1)).toMatchObject({
      status: 'Available', effectiveMinutesIfStartedNow: 7,
    })
    expect(liveQuiz(available, Date.parse(closesAt) - 1).effectiveMinutesIfStartedNow).toBe(0)
    expect(liveQuiz(available, Date.parse(closesAt) + 1).status).toBe('Missed')
  })

  it('does not guess server-owned attempt outcomes or alter completed quizzes', () => {
    for (const status of ['InProgress', 'Completed', 'Missed'] as const) {
      const original = card(status)
      expect(liveQuiz(original, Date.parse(closesAt) + 1)).toBe(original)
    }
  })

  it('regroups transitioned cards and orders the available and missed groups by closing time', () => {
    const now = Date.parse('2026-09-24T10:09:00Z')
    const recentlyClosed = { ...card('Available'), id: 'closed-now' }
    const olderMissed = { ...card('Missed'), id: 'closed-earlier', closesAt: '2026-09-24T09:00:00Z' }
    const stillUpcoming = { ...card('Upcoming'), id: 'future', opensAt: '2026-09-24T11:00:00Z', closesAt: '2026-09-24T12:00:00Z' }
    const alreadyCompleted = { ...card('Completed'), id: 'completed' }
    expect(liveQuizList([recentlyClosed, olderMissed, stillUpcoming, alreadyCompleted], now)
      .map((quiz) => quiz.id)).toEqual(['future', 'completed', 'closed-now', 'closed-earlier'])
  })
})
