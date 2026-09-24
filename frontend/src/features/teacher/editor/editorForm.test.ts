import { describe, expect, it } from 'vitest'
import type { QuizEditorView } from '../../../api/types'
import { en } from '../../../i18n/en'
import {
  emptyQuestion,
  fromLocalInput,
  fromView,
  problemLines,
  toLocalInput,
  toUpsert,
  validate,
  type EditorValues,
} from './editorForm'

const NOW = Date.parse('2026-09-24T09:00:00Z')

const valid = (): EditorValues => ({
  title: 'Algebra check',
  description: '',
  classRoomIds: ['class-a'],
  opensAt: toLocalInput('2026-09-25T07:00:00Z'),
  closesAt: toLocalInput('2026-10-01T07:00:00Z'),
  stored: { opensAt: null, closesAt: null },
  durationMinutes: '20',
  penalty: '25',
  customPenalty: '',
  questions: [{ uid: 'q1', text: '2 + 2?', points: '2', correct: '1', options: [{ text: '3' }, { text: '4' }, { text: '5' }] }],
})

describe('local time conversion', () => {
  it('round-trips a UTC instant through the datetime-local value', () => {
    const iso = '2026-09-26T07:00:00.000Z'
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso)
  })

  it('treats empty or broken input as missing', () => {
    expect(fromLocalInput('')).toBeNull()
    expect(fromLocalInput('not a date')).toBeNull()
  })
})

describe('validate', () => {
  it('accepts a complete quiz', () => {
    expect(validate(valid(), 'publish', NOW, en.editor)).toEqual({})
  })

  it('asks for a missing time but explains a time that does not exist', () => {
    const problems = validate({ ...valid(), opensAt: '', closesAt: '2026-02-30T10:00' }, 'save', NOW, en.editor)
    expect(problems.opensAt).toEqual(['Choose when the quiz opens.'])
    expect(problems.closesAt).toEqual([en.editor.notRealTime])
  })

  it('keys problems like the server so both land on the same fields', () => {
    const values = valid()
    values.title = 'Hi'
    values.classRoomIds = []
    values.durationMinutes = '0'
    values.questions[0] = { ...values.questions[0], text: ' ', points: '101', correct: '' }
    values.questions[0].options[2] = { text: '' }

    const problems = validate(values, 'save', NOW, en.editor)

    expect(Object.keys(problems).sort()).toEqual(
      [
        'classRoomIds',
        'durationMinutes',
        'questions[0].options',
        'questions[0].options[2].text',
        'questions[0].points',
        'questions[0].text',
        'title',
      ].sort(),
    )
    expect(problems['questions[0].options']).toEqual([en.editor.needsCorrect])
  })

  it('requires the close after the open, and in the future only when publishing', () => {
    const past = valid()
    past.opensAt = toLocalInput('2026-09-01T07:00:00Z')
    past.closesAt = toLocalInput('2026-09-10T07:00:00Z')
    expect(validate(past, 'save', NOW, en.editor)).toEqual({})
    expect(validate(past, 'publish', NOW, en.editor).closesAt).toEqual(['The closing time must be in the future.'])

    const reversed = valid()
    reversed.closesAt = reversed.opensAt
    expect(validate(reversed, 'save', NOW, en.editor).closesAt).toEqual(['Must be after the opening time.'])
  })

  it('lets a draft have no questions but not a published quiz', () => {
    const values = { ...valid(), questions: [] }
    expect(validate(values, 'save', NOW, en.editor)).toEqual({})
    expect(validate(values, 'publish', NOW, en.editor).questions).toEqual(['Add at least one question before publishing.'])
  })

  it('checks the option count and a custom penalty', () => {
    const values = valid()
    values.questions[0].options = [{ text: 'only' }]
    values.questions[0].correct = '0'
    values.penalty = 'custom'
    values.customPenalty = '120'
    const problems = validate(values, 'save', NOW, en.editor)
    expect(problems['questions[0].options']).toEqual(['A question needs 2–6 options.'])
    expect(problems.wrongAnswerPenaltyPercent).toBeDefined()
  })
})

describe('mapping', () => {
  it('builds the API request with exactly one correct option and UTC times', () => {
    const upsert = toUpsert(valid())
    expect(upsert.wrongAnswerPenaltyPercent).toBe(25)
    expect(upsert.opensAt).toBe('2026-09-25T07:00:00.000Z')
    expect(upsert.description).toBeNull()
    expect(upsert.questions[0].options.map((o) => o.isCorrect)).toEqual([false, true, false])
  })

  it('reads a saved quiz back, keeping order and the custom penalty', () => {
    const view: QuizEditorView = {
      id: 'q',
      title: 'Saved',
      description: null,
      classRooms: [{ id: 'class-a', name: '10A' }],
      opensAt: '2026-09-25T07:00:00Z',
      closesAt: '2026-10-01T07:00:00Z',
      durationMinutes: 15,
      wrongAnswerPenaltyPercent: 40,
      isPublished: false,
      state: 'Draft',
      isLocked: false,
      maxScore: 3,
      questions: [
        { id: 'b', order: 2, text: 'Second', points: 2, options: [{ id: 'o3', order: 1, text: 'x', isCorrect: true }, { id: 'o4', order: 2, text: 'y', isCorrect: false }] },
        { id: 'a', order: 1, text: 'First', points: 1, options: [{ id: 'o2', order: 2, text: 'b', isCorrect: true }, { id: 'o1', order: 1, text: 'a', isCorrect: false }] },
      ],
    }
    const values = fromView(view)
    expect(values.penalty).toBe('custom')
    expect(values.customPenalty).toBe('40')
    expect(values.questions.map((q) => q.text)).toEqual(['First', 'Second'])
    expect(values.questions[0].options.map((o) => o.text)).toEqual(['a', 'b'])
    expect(values.questions[0].correct).toBe('1')
  })

  it('starts a new question with four empty options and no correct answer', () => {
    expect(emptyQuestion().options).toHaveLength(4)
    expect(emptyQuestion().correct).toBe('')
  })
})

describe('problemLines', () => {
  it('names the question for question problems', () => {
    expect(problemLines({ 'questions[1].options': [en.editor.needsCorrect], title: ['Title must be 3–200 characters.'] }, en.editor)).toEqual([
      'Question 2 needs a correct answer.',
      'Title must be 3–200 characters.',
    ])
  })
})
