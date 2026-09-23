import { request } from './client'
import type { AttemptResult, AttemptView, SaveAnswerResponse, StudentQuizList } from './types'

export const studentKeys = {
  all: ['student'] as const,
  quizzes: () => [...studentKeys.all, 'quizzes'] as const,
  attempt: (id: string) => [...studentKeys.all, 'attempt', id] as const,
  result: (id: string) => [...studentKeys.all, 'result', id] as const,
}

export const listStudentQuizzes = (signal?: AbortSignal) =>
  request<StudentQuizList>('GET', '/api/student/quizzes', { signal })

export const startAttempt = (quizId: string) =>
  request<AttemptView>('POST', `/api/student/quizzes/${quizId}/attempt`)

export const getAttempt = (attemptId: string, signal?: AbortSignal) =>
  request<AttemptView>('GET', `/api/student/attempts/${attemptId}`, { signal })

export const saveAnswer = (attemptId: string, questionId: string, selectedOptionId: string | null, signal?: AbortSignal) =>
  request<SaveAnswerResponse>('PUT', `/api/student/attempts/${attemptId}/answers/${questionId}`, {
    body: { selectedOptionId }, signal,
  })

export const submitAttempt = (attemptId: string) =>
  request<AttemptResult>('POST', `/api/student/attempts/${attemptId}/submit`)

export const getAttemptResult = (attemptId: string, signal?: AbortSignal) =>
  request<AttemptResult>('GET', `/api/student/attempts/${attemptId}/result`, { signal })
