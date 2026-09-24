import { request } from './client'
import type { QuizEditorView, QuizResults, QuizUpsert, TeacherClassRoom, TeacherQuizSummary } from './types'

export const teacherKeys = {
  all: ['teacher'] as const,
  classRooms: () => [...teacherKeys.all, 'classrooms'] as const,
  quizzes: () => [...teacherKeys.all, 'quizzes'] as const,
  quiz: (id: string) => [...teacherKeys.all, 'quiz', id] as const,
  results: (id: string) => [...teacherKeys.all, 'results', id] as const,
}

export const listClassRooms = (signal?: AbortSignal) =>
  request<TeacherClassRoom[]>('GET', '/api/teacher/classrooms', { signal })

export const listTeacherQuizzes = (signal?: AbortSignal) =>
  request<TeacherQuizSummary[]>('GET', '/api/teacher/quizzes', { signal })

export const getTeacherQuiz = (id: string, signal?: AbortSignal) =>
  request<QuizEditorView>('GET', `/api/teacher/quizzes/${id}`, { signal })

export const createTeacherQuiz = (quiz: QuizUpsert) =>
  request<{ id: string }>('POST', '/api/teacher/quizzes', { body: quiz })

export const updateTeacherQuiz = (id: string, quiz: QuizUpsert) =>
  request<QuizEditorView>('PUT', `/api/teacher/quizzes/${id}`, { body: quiz })

export const publishTeacherQuiz = (id: string) =>
  request<QuizEditorView>('POST', `/api/teacher/quizzes/${id}/publish`)

export const unpublishTeacherQuiz = (id: string) =>
  request<QuizEditorView>('POST', `/api/teacher/quizzes/${id}/unpublish`)

export const deleteTeacherQuiz = (id: string) => request<void>('DELETE', `/api/teacher/quizzes/${id}`)

export const getQuizResults = (id: string, signal?: AbortSignal) =>
  request<QuizResults>('GET', `/api/teacher/quizzes/${id}/results`, { signal })
