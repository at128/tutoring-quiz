import { request } from './client'
import type { StudentQuizList } from './types'

export const studentKeys = {
  all: ['student'] as const,
  quizzes: () => [...studentKeys.all, 'quizzes'] as const,
}

export const listStudentQuizzes = (signal?: AbortSignal) =>
  request<StudentQuizList>('GET', '/api/student/quizzes', { signal })
