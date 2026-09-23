import type { AttemptQuestion } from '../../../api/types'

// Pure answer state for one attempt. Each question keeps what the server has confirmed (`server`) and what the
// student picked on this device (`desired`). A question is pending while the two differ; only the server value
// can ever count towards the score.

export type SaveStatus = 'saved' | 'saving' | 'failed'

export type Answer = {
  /** Last selection the server confirmed (null = unanswered / cleared). */
  server: string | null
  /** Selection shown on screen. */
  desired: string | null
  status: SaveStatus
}

export type Answers = Readonly<Record<string, Answer>>

export type AnswerAction =
  | { type: 'choose'; questionId: string; optionId: string | null }
  | { type: 'saved'; questionId: string; sent: string | null; confirmed: string | null }
  | { type: 'failed'; questionId: string; sent: string | null }
  | { type: 'rejected'; questionId: string }
  | { type: 'sync'; questions: AttemptQuestion[] }

export const fromServer = (questions: AttemptQuestion[]): Answers =>
  Object.fromEntries(
    questions.map((q) => [q.id, { server: q.selectedOptionId, desired: q.selectedOptionId, status: 'saved' as const }]),
  )

export const isPending = (answer: Answer) => answer.desired !== answer.server

export const pendingQuestionIds = (answers: Answers) => Object.keys(answers).filter((id) => isPending(answers[id]))

/** Answered as far as the student can see on this device (saved or still being sent). */
export const isAnswered = (answer: Answer | undefined) => answer?.desired != null

export const answeredCount = (answers: Answers) => Object.values(answers).filter(isAnswered).length

export const hasFailures = (answers: Answers) => Object.values(answers).some((a) => a.status === 'failed')

const statusFor = (server: string | null, desired: string | null, previous: SaveStatus): SaveStatus =>
  server === desired ? 'saved' : previous === 'failed' ? 'failed' : 'saving'

export function answersReducer(state: Answers, action: AnswerAction): Answers {
  switch (action.type) {
    case 'choose': {
      const current = state[action.questionId]
      if (!current || current.desired === action.optionId) return state
      const status: SaveStatus = current.server === action.optionId ? 'saved' : 'saving'
      return { ...state, [action.questionId]: { ...current, desired: action.optionId, status } }
    }

    case 'saved': {
      const current = state[action.questionId]
      if (!current) return state
      const status: SaveStatus = current.desired === action.confirmed ? 'saved' : 'saving'
      return { ...state, [action.questionId]: { ...current, server: action.confirmed, status } }
    }

    case 'failed': {
      const current = state[action.questionId]
      // A newer choice is already queued: that one decides what to show.
      if (!current || current.desired !== action.sent) return state
      return { ...state, [action.questionId]: { ...current, status: 'failed' } }
    }

    case 'rejected': {
      // The server refused the value itself (not a connection problem): fall back to what it has.
      const current = state[action.questionId]
      if (!current) return state
      return { ...state, [action.questionId]: { ...current, desired: current.server, status: 'saved' } }
    }

    case 'sync': {
      // Fresh data from the server (phone unlocked, tab back): adopt its values unless a local change is queued.
      const next: Record<string, Answer> = {}
      for (const question of action.questions) {
        const current = state[question.id]
        const server = question.selectedOptionId
        const desired = current && isPending(current) ? current.desired : server
        next[question.id] = { server, desired, status: statusFor(server, desired, current?.status ?? 'saved') }
      }
      return next
    }
  }
}
