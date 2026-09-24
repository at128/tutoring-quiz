import { afterEach, describe, expect, it, vi } from 'vitest'
import type { QuizEditorView } from '../../../api/types'
import { en } from '../../../i18n/en'
import { fromLocalInput, fromView, instantOf, toLocalInput, toUpsert, validate } from './editorForm'

afterEach(() => vi.unstubAllEnvs())

const savedQuiz = (opensAt: string, closesAt: string): QuizEditorView => ({
  id: 'q',
  title: 'Saved quiz',
  description: null,
  classRooms: [{ id: 'class-a', name: '10A' }],
  opensAt,
  closesAt,
  durationMinutes: 20,
  wrongAnswerPenaltyPercent: 0,
  isPublished: true,
  state: 'Scheduled',
  isLocked: false,
  maxScore: 1,
  questions: [{ id: 'a', order: 1, text: '2 + 2?', points: 1, options: [{ id: 'o1', order: 1, text: '4', isCorrect: true }, { id: 'o2', order: 2, text: '5', isCorrect: false }] }],
})

describe('teacher local-time edge cases', () => {
  it('rejects a calendar date that JavaScript would silently move to another day', () => {
    expect(fromLocalInput('2026-02-30T10:00')).toBeNull()
    expect(fromLocalInput('2026-04-31T10:00')).toBeNull()
    expect(fromLocalInput('2026-09-26T24:00')).toBeNull()
  })

  it('rejects a nonexistent wall-clock time in the spring DST gap', () => {
    vi.stubEnv('TZ', 'Asia/Jerusalem') // clocks jump 02:00 → 03:00 on 2026-03-27
    expect(fromLocalInput('2026-03-27T02:30')).toBeNull()
    expect(fromLocalInput('2026-03-27T03:30')).toBe('2026-03-27T00:30:00.000Z')
    expect(fromLocalInput('2026-03-27T01:30')).toBe('2026-03-26T23:30:00.000Z')
  })

  it('does not lose seconds or milliseconds when an existing quiz is opened and saved', () => {
    vi.stubEnv('TZ', 'UTC')
    const opens = '2026-09-24T10:00:45.123Z'
    const closes = '2026-10-01T10:00:59.999Z'
    expect(instantOf(toLocalInput(opens), opens)).toBe(opens)

    const values = fromView(savedQuiz(opens, closes))
    expect(toUpsert(values)).toMatchObject({ opensAt: opens, closesAt: closes })
    expect(validate(values, 'publish', Date.parse('2026-10-01T10:00:30Z'), en.editor)).toEqual({})
  })

  it('uses the typed time once the teacher changes the minute shown', () => {
    vi.stubEnv('TZ', 'UTC')
    const values = { ...fromView(savedQuiz('2026-09-24T10:00:45.123Z', '2026-10-01T10:00:00Z')), opensAt: '2026-09-24T11:30' }
    expect(toUpsert(values).opensAt).toBe('2026-09-24T11:30:00.000Z')
  })
})
