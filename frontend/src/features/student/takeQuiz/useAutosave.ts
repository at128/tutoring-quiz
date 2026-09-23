import { useCallback, useEffect, useRef, useState, type Dispatch } from 'react'
import { isApiError } from '../../../api/client'
import { saveAnswer } from '../../../api/student'
import { pendingQuestionIds, type AnswerAction, type Answers } from './answers'
import { retryDelayMs } from './timer'

type Options = {
  attemptId: string
  answers: Answers
  dispatch: Dispatch<AnswerAction>
  /** False from the deadline on: nothing more is sent or retried, and late replies are ignored. */
  active: boolean
  /** The server says the attempt is over (time up elsewhere, or already submitted). */
  onAttemptClosed: () => void
}

/**
 * Sends every pending answer as soon as it's chosen (one request per question at a time, always the latest
 * choice). Connection or server failures retry with backoff (1 s, 2 s, 4 s, 8 s…) and immediately when the
 * device comes back online. Answers the server already confirmed are never at risk.
 */
export function useAutosave({ attemptId, answers, dispatch, active, onAttemptClosed }: Options) {
  const inFlight = useRef(new Set<string>())
  const failures = useRef(new Map<string, number>())
  const waiting = useRef(new Map<string, number>())
  const latest = useRef({ active, onAttemptClosed })
  const [wake, setWake] = useState(0)

  useEffect(() => {
    latest.current = { active, onAttemptClosed }
  })

  const clearRetries = useCallback(() => {
    for (const timer of waiting.current.values()) window.clearTimeout(timer)
    waiting.current.clear()
  }, [])

  const send = useCallback(
    async (questionId: string, optionId: string | null) => {
      inFlight.current.add(questionId)
      try {
        const saved = await saveAnswer(attemptId, questionId, optionId)
        failures.current.delete(questionId)
        if (latest.current.active)
          dispatch({ type: 'saved', questionId, sent: optionId, confirmed: saved.selectedOptionId })
      } catch (error) {
        if (!latest.current.active) return
        if (isApiError(error, 'attempt.deadline_passed', 'attempt.not_in_progress') || isApiError(error, 'not_found')) {
          latest.current.onAttemptClosed()
          return
        }
        if (isApiError(error, 'answer.invalid_option', 'validation_failed')) {
          dispatch({ type: 'rejected', questionId })
          return
        }
        if (isApiError(error) && error.status === 401) return // the auth layer sends the student to sign in

        // Lost connection or a server error: keep the choice and try again shortly.
        const count = (failures.current.get(questionId) ?? 0) + 1
        failures.current.set(questionId, count)
        dispatch({ type: 'failed', questionId, sent: optionId })
        const timer = window.setTimeout(() => {
          waiting.current.delete(questionId)
          setWake((n) => n + 1)
        }, retryDelayMs(count))
        waiting.current.set(questionId, timer)
      } finally {
        inFlight.current.delete(questionId)
        setWake((n) => n + 1)
      }
    },
    [attemptId, dispatch],
  )

  // Whenever answers change (or a retry is due), send whatever is pending and not already on its way.
  useEffect(() => {
    if (!active) {
      clearRetries()
      return
    }
    for (const questionId of pendingQuestionIds(answers)) {
      if (inFlight.current.has(questionId) || waiting.current.has(questionId)) continue
      void send(questionId, answers[questionId].desired)
    }
  }, [answers, active, wake, send, clearRetries])

  const retryNow = useCallback(() => {
    clearRetries()
    setWake((n) => n + 1)
  }, [clearRetries])

  useEffect(() => {
    window.addEventListener('online', retryNow)
    return () => {
      window.removeEventListener('online', retryNow)
      clearRetries()
    }
  }, [retryNow, clearRetries])

  return { pendingCount: pendingQuestionIds(answers).length, retryNow }
}
