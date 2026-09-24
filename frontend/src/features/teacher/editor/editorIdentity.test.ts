import { describe, expect, it } from 'vitest'
import type { QuizEditorView } from '../../../api/types'
import { en } from '../../../i18n/en'
import { emptyQuestion, fromView, toUpsert, validate } from './editorForm'

// Editing a closed quiz keeps students' answers attached: the editor sends every saved question and option back with
// its id. It also carries the score-visibility setting and a fixed mark per wrong answer.

const quiz: QuizEditorView = {
  id: 'q',
  title: 'Saved quiz',
  description: null,
  classRooms: [{ id: 'class-a', name: '10A' }],
  opensAt: '2026-09-24T10:00:00Z',
  closesAt: '2026-10-01T10:00:00Z',
  durationMinutes: 20,
  wrongAnswerPenaltyPercent: 25,
  wrongAnswerPenaltyPoints: null,
  scoresVisibleToStudents: true,
  isPublished: true,
  state: 'Closed',
  isLocked: false,
  hasAttempts: true,
  maxScore: 2,
  questions: [
    { id: 'q1', order: 1, text: '2 + 2?', points: 2, options: [{ id: 'o1', order: 1, text: '4', isCorrect: true }, { id: 'o2', order: 2, text: '5', isCorrect: false }] },
  ],
}

describe('question and option identity', () => {
  it('sends back the saved ids, and none for a question or option added in the editor', () => {
    const values = fromView(quiz)
    values.questions[0].options.push({ text: '6' })
    values.questions.push({ ...emptyQuestion(), text: 'New?', correct: '0', options: [{ text: 'a' }, { text: 'b' }] })

    const upsert = toUpsert(values)

    expect(upsert.questions[0]).toMatchObject({ id: 'q1', options: [{ id: 'o1' }, { id: 'o2' }, { id: null, text: '6' }] })
    expect(upsert.questions[1]).toMatchObject({ id: null, options: [{ id: null }, { id: null }] })
  })

  it('keeps an option’s id when only its text or correctness changes', () => {
    const values = fromView(quiz)
    values.questions[0].options[1].text = 'five'
    values.questions[0].correct = '1'

    expect(toUpsert(values).questions[0].options).toEqual([
      { id: 'o1', text: '4', isCorrect: false },
      { id: 'o2', text: 'five', isCorrect: true },
    ])
  })
})

describe('score visibility', () => {
  it('round-trips both settings, and a form without it shows scores', () => {
    expect(toUpsert(fromView(quiz)).scoresVisibleToStudents).toBe(true)
    expect(toUpsert(fromView({ ...quiz, scoresVisibleToStudents: false })).scoresVisibleToStudents).toBe(false)
    expect(toUpsert({ ...fromView(quiz), scoresVisible: undefined }).scoresVisibleToStudents).toBe(true)
  })
})

describe('a fixed mark per wrong answer', () => {
  it('opens a fixed-mark quiz as such and sends no percentage with it', () => {
    const values = fromView({ ...quiz, wrongAnswerPenaltyPercent: 0, wrongAnswerPenaltyPoints: 0.5 })
    expect(values.penalty).toBe('points')
    expect(values.penaltyPoints).toBe('0.5')
    expect(toUpsert(values)).toMatchObject({ wrongAnswerPenaltyPercent: 0, wrongAnswerPenaltyPoints: 0.5 })
  })

  it.each([
    ['0.5', 0.5],
    ['.25', 0.25],
    ['٠٫٥', 0.5],
    ['1,5', 1.5],
    ['100', 100],
  ])('reads %s as %s', (typed, expected) => {
    const values = { ...fromView(quiz), penalty: 'points' as const, penaltyPoints: typed }
    expect(validate(values, 'save', 0, en.editor)).not.toHaveProperty('wrongAnswerPenaltyPoints')
    expect(toUpsert(values).wrongAnswerPenaltyPoints).toBe(expected)
  })

  it.each([[''], ['0'], ['-1'], ['0.333'], ['100.5'], ['half']])('refuses %s', (typed) => {
    const values = { ...fromView(quiz), penalty: 'points' as const, penaltyPoints: typed }
    expect(validate(values, 'save', 0, en.editor).wrongAnswerPenaltyPoints).toEqual([en.editor.penaltyPointsRange])
  })

  it('sends no fixed mark with a percentage or with no marking', () => {
    expect(toUpsert({ ...fromView(quiz), penalty: '25', penaltyPoints: '0.5' })).toMatchObject({
      wrongAnswerPenaltyPercent: 25,
      wrongAnswerPenaltyPoints: null,
    })
    expect(toUpsert({ ...fromView(quiz), penalty: '0' })).toMatchObject({ wrongAnswerPenaltyPercent: 0, wrongAnswerPenaltyPoints: null })
  })
})
