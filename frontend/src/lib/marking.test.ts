import { describe, expect, it } from 'vitest'
import type { AttemptResult } from '../api/types'
import { scoringExplanation } from '../features/student/resultCopy'
import { markingText } from '../features/teacher/teacherMarking'
import { ar } from '../i18n/ar'
import { en } from '../i18n/en'
import { deductionFor, markingOf } from './marking'

describe('a quiz’s negative marking', () => {
  it('reads the server’s two fields as none, a percentage or a fixed mark', () => {
    expect(markingOf({ wrongAnswerPenaltyPercent: 0, wrongAnswerPenaltyPoints: null })).toEqual({ kind: 'none' })
    expect(markingOf({ wrongAnswerPenaltyPercent: 25, wrongAnswerPenaltyPoints: null })).toEqual({ kind: 'percent', percent: 25 })
    expect(markingOf({ wrongAnswerPenaltyPercent: 0, wrongAnswerPenaltyPoints: 0.5 })).toEqual({ kind: 'points', points: 0.5 })
  })

  it('never takes more than the question is worth (the server’s rule)', () => {
    expect(deductionFor({ kind: 'points', points: 2 }, 1)).toBe(1)
    expect(deductionFor({ kind: 'points', points: 0.5 }, 4)).toBe(0.5)
    expect(deductionFor({ kind: 'percent', percent: 25 }, 4)).toBe(1)
    expect(deductionFor({ kind: 'none' }, 4)).toBe(0)
  })

  it('is described in both languages on the teacher screens', () => {
    expect(markingText({ kind: 'points', points: 0.5 }, en)).toBe(en.teacher.markingLongPoints(0.5))
    expect(markingText({ kind: 'percent', percent: 25 }, ar)).toBe(ar.teacher.markingLong(25))
    expect(markingText({ kind: 'none' }, en)).toBe(en.teacher.markingLong(0))
  })
})

describe('the student’s scoring explanation with a fixed mark', () => {
  const result = (over: Partial<AttemptResult>) =>
    ({ scoreVisible: true, score: 3, wrongCount: 1, wrongAnswerPenaltyPercent: 0, wrongAnswerPenaltyPoints: 0.5, ...over }) as AttemptResult

  it('names the fixed mark in English and Arabic', () => {
    expect(scoringExplanation(result({}), en)).toContain(en.result.markingRulePoints(0.5))
    expect(scoringExplanation(result({}), ar)).toContain(ar.result.markingRulePoints(0.5))
  })

  it('says when the deductions used up everything earned', () => {
    expect(scoringExplanation(result({ score: 0, wrongCount: 3 }), en)).toContain(en.result.stoppedAtZero)
  })
})
