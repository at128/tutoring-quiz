import { createBrowserRouter } from 'react-router'
import { AuthProvider } from './auth/AuthProvider'
import { RequireRole, RoleRedirect } from './auth/RequireRole'
import { LoginPage } from './features/auth/LoginPage'
import { NotFoundPage } from './features/NotFoundPage'
import { QuizListPage } from './features/student/QuizListPage'
import { ResultPage } from './features/student/ResultPage'
import { StartQuizPage } from './features/student/StartQuizPage'
import { TakeQuizPage } from './features/student/TakeQuizPage'
import { QuizEditorPage } from './features/teacher/QuizEditorPage'
import { TeacherQuizListPage } from './features/teacher/QuizListPage'
import { ResultsPage as TeacherResultsPage } from './features/teacher/ResultsPage'

export const router = createBrowserRouter([
  {
    element: <AuthProvider />,
    children: [
      { path: '/', element: <RoleRedirect /> },
      { path: '/login', element: <LoginPage /> },
      {
        path: '/student',
        element: <RequireRole role="Student" />,
        children: [
          { index: true, element: <QuizListPage /> },
          { path: 'quizzes/:quizId', element: <StartQuizPage /> },
          { path: 'attempts/:attemptId', element: <TakeQuizPage /> },
          { path: 'attempts/:attemptId/result', element: <ResultPage /> },
        ],
      },
      {
        path: '/teacher',
        element: <RequireRole role="Teacher" />,
        children: [
          { index: true, element: <TeacherQuizListPage /> },
          { path: 'quizzes/new', element: <QuizEditorPage /> },
          { path: 'quizzes/:quizId/edit', element: <QuizEditorPage /> },
          { path: 'quizzes/:quizId/results', element: <TeacherResultsPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
