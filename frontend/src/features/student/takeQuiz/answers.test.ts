import { describe, expect, it } from 'vitest'
import type { AttemptQuestion } from '../../../api/types'
import { answeredCount, answersReducer, fromServer, hasFailures, pendingQuestionIds, type Answers } from './answers'

const question = (id: string, selectedOptionId: string | null = null): AttemptQuestion => ({
  id,
  order: 1,
  text: `Question ${id}`,
  points: 1,
  options: [
    { id: `${id}-a`, order: 1, text: 'A' },
    { id: `${id}-b`, order: 2, text: 'B' },
  ],
  selectedOptionId,
})

const initial = (): Answers => fromServer([question('q1'), question('q2', 'q2-a')])

describe('answersReducer', () => {
  it('starts from what the server has saved', () => {
    const state = initial()
    expect(state.q2).toEqual({ server: 'q2-a', desired: 'q2-a', uncertain: false, status: 'saved' })
    expect(answeredCount(state)).toBe(1)
    expect(pendingQuestionIds(state)).toEqual([])
  })

  it('shows a choice immediately and marks it as saving until the server confirms', () => {
    const chosen = answersReducer(initial(), { type: 'choose', questionId: 'q1', optionId: 'q1-b' })
    expect(chosen.q1).toEqual({ server: null, desired: 'q1-b', uncertain: false, status: 'saving' })
    expect(pendingQuestionIds(chosen)).toEqual(['q1'])

    const saved = answersReducer(chosen, { type: 'saved', questionId: 'q1', sent: 'q1-b', confirmed: 'q1-b' })
    expect(saved.q1).toEqual({ server: 'q1-b', desired: 'q1-b', uncertain: false, status: 'saved' })
    expect(pendingQuestionIds(saved)).toEqual([])
  })

  it('keeps a newer choice pending when an older save comes back', () => {
    let state = answersReducer(initial(), { type: 'choose', questionId: 'q1', optionId: 'q1-a' })
    state = answersReducer(state, { type: 'choose', questionId: 'q1', optionId: 'q1-b' })
    state = answersReducer(state, { type: 'saved', questionId: 'q1', sent: 'q1-a', confirmed: 'q1-a' })

    expect(state.q1).toEqual({ server: 'q1-a', desired: 'q1-b', uncertain: false, status: 'saving' })
    expect(pendingQuestionIds(state)).toEqual(['q1'])
  })

  it('marks a failed save without losing the choice, and ignores failures of superseded values', () => {
    let state = answersReducer(initial(), { type: 'choose', questionId: 'q1', optionId: 'q1-a' })
    state = answersReducer(state, { type: 'failed', questionId: 'q1', sent: 'q1-a' })
    expect(state.q1).toEqual({ server: null, desired: 'q1-a', uncertain: true, status: 'failed' })
    expect(hasFailures(state)).toBe(true)

    state = answersReducer(state, { type: 'choose', questionId: 'q1', optionId: 'q1-b' })
    state = answersReducer(state, { type: 'failed', questionId: 'q1', sent: 'q1-a' })
    expect(state.q1.status).toBe('saving')
  })

  it('clearing an answer is a change like any other (null)', () => {
    const state = answersReducer(initial(), { type: 'choose', questionId: 'q2', optionId: null })
    expect(state.q2).toEqual({ server: 'q2-a', desired: null, uncertain: false, status: 'saving' })
    expect(answeredCount(state)).toBe(0)
  })

  it('choosing the saved value again cancels the pending change', () => {
    let state = answersReducer(initial(), { type: 'choose', questionId: 'q2', optionId: 'q2-b' })
    state = answersReducer(state, { type: 'choose', questionId: 'q2', optionId: 'q2-a' })
    expect(state.q2).toEqual({ server: 'q2-a', desired: 'q2-a', uncertain: false, status: 'saved' })
  })

  it('falls back to the server value when the server rejects the answer itself', () => {
    let state = answersReducer(initial(), { type: 'choose', questionId: 'q2', optionId: 'q2-b' })
    state = answersReducer(state, { type: 'rejected', questionId: 'q2', sent: 'q2-b' })
    expect(state.q2).toEqual({ server: 'q2-a', desired: 'q2-a', uncertain: false, status: 'saved' })
  })

  it('sync adopts server values but keeps choices that are still waiting to be sent', () => {
    let state = answersReducer(initial(), { type: 'choose', questionId: 'q1', optionId: 'q1-b' })
    state = answersReducer(state, { type: 'failed', questionId: 'q1', sent: 'q1-b' })
    // Another tab changed q2 on the server meanwhile.
    state = answersReducer(state, { type: 'sync', questions: [question('q1'), question('q2', 'q2-b')] })

    expect(state.q1).toEqual({ server: null, desired: 'q1-b', uncertain: true, status: 'failed' })
    expect(state.q2).toEqual({ server: 'q2-b', desired: 'q2-b', uncertain: false, status: 'saved' })
  })

  it('requires a compensating save after an in-flight choice succeeds following a revert', () => {
    let state = answersReducer(initial(), { type: 'choose', questionId: 'q1', optionId: 'q1-a' })
    state = answersReducer(state, { type: 'choose', questionId: 'q1', optionId: null })
    expect(pendingQuestionIds(state)).toEqual([]) // the in-flight request is tracked by useAutosave
    state = answersReducer(state, { type: 'saved', questionId: 'q1', sent: 'q1-a', confirmed: 'q1-a' })
    expect(state.q1).toEqual({ server: 'q1-a', desired: null, uncertain: false, status: 'saving' })
    expect(pendingQuestionIds(state)).toEqual(['q1'])
    state = answersReducer(state, { type: 'saved', questionId: 'q1', sent: null, confirmed: null })
    expect(pendingQuestionIds(state)).toEqual([])
  })

  it('retries the desired value after an ambiguous failure, even when it equals the last confirmation', () => {
    let state = answersReducer(initial(), { type: 'choose', questionId: 'q1', optionId: 'q1-a' })
    state = answersReducer(state, { type: 'choose', questionId: 'q1', optionId: null })
    state = answersReducer(state, { type: 'failed', questionId: 'q1', sent: 'q1-a' })
    expect(state.q1).toEqual({ server: null, desired: null, uncertain: true, status: 'saving' })
    expect(pendingQuestionIds(state)).toEqual(['q1'])
    state = answersReducer(state, { type: 'saved', questionId: 'q1', sent: null, confirmed: null })
    expect(pendingQuestionIds(state)).toEqual([])
  })

  it('does not roll back a newer choice when an older save is rejected', () => {
    let state = answersReducer(initial(), { type: 'choose', questionId: 'q1', optionId: 'q1-a' })
    state = answersReducer(state, { type: 'choose', questionId: 'q1', optionId: 'q1-b' })
    state = answersReducer(state, { type: 'rejected', questionId: 'q1', sent: 'q1-a' })
    expect(state.q1.desired).toBe('q1-b')
    expect(pendingQuestionIds(state)).toEqual(['q1'])
  })
})
