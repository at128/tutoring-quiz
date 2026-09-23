// Mirrors docs/API.md (v1, locked). Keep in sync with the backend records.

export type Role = 'Student' | 'Teacher'
export type ClassRoomRef = { id: string; name: string }
export type CurrentUser = { id: string; username: string; fullName: string; role: Role; classRoom: ClassRoomRef | null }

export type AttemptStatus = 'InProgress' | 'Submitted' | 'Expired'
export type StudentQuizStatus = 'Upcoming' | 'Available' | 'InProgress' | 'Completed' | 'Missed'
export type TeacherQuizState = 'Draft' | 'Scheduled' | 'Open' | 'Closed'
export type ResultRowStatus = 'NotStarted' | 'InProgress' | 'Submitted' | 'Expired' | 'Missed'

export type ErrorCode =
  | 'auth.invalid_credentials'
  | 'auth.unauthenticated'
  | 'auth.forbidden'
  | 'rate_limited'
  | 'validation_failed'
  | 'not_found'
  | 'quiz.not_open_yet'
  | 'quiz.closed'
  | 'attempt.already_taken'
  | 'attempt.deadline_passed'
  | 'attempt.not_in_progress'
  | 'attempt.not_finalized'
  | 'answer.invalid_option'
  | 'quiz.locked'
  | 'quiz.has_attempts'
  | 'quiz.invalid_for_publish'

export type ProblemDetails = {
  type?: string
  title?: string
  status?: number
  detail?: string | null
  code?: string
  errors?: Record<string, string[]>
}

export type LoginRequest = { username: string; password: string }

// ---- Student ----

export type StudentQuizList = { serverNow: string; quizzes: StudentQuizCard[] }

export type StudentQuizCard = {
  id: string
  title: string
  description: string | null
  teacherName: string
  opensAt: string
  closesAt: string
  durationMinutes: number
  questionCount: number
  maxScore: number
  wrongAnswerPenaltyPercent: number
  status: StudentQuizStatus
  /** Only when Available: min(duration, minutes until close), rounded down. */
  effectiveMinutesIfStartedNow: number | null
  attempt: { id: string; status: AttemptStatus; deadline: string; score: number | null; maxScore: number } | null
}

export type AttemptQuestion = {
  id: string
  order: number
  text: string
  points: number
  options: { id: string; order: number; text: string }[]
  selectedOptionId: string | null
}

export type AttemptView = {
  id: string
  quizId: string
  quizTitle: string
  status: AttemptStatus
  startedAt: string
  deadline: string
  serverNow: string
  wrongAnswerPenaltyPercent: number
  maxScore: number
  questions: AttemptQuestion[]
  result: AttemptResult | null
}

export type AttemptResult = {
  attemptId: string
  quizId: string
  quizTitle: string
  status: 'Submitted' | 'Expired'
  startedAt: string
  finalizedAt: string
  score: number
  maxScore: number
  percentage: number
  correctCount: number
  wrongCount: number
  unansweredCount: number
  wrongAnswerPenaltyPercent: number
  /** = quiz closesAt */
  reviewAvailableAt: string
  /** null until the quiz has closed (stretch S2; always null if not built) */
  review: ReviewItem[] | null
}

export type ReviewItem = {
  questionId: string
  text: string
  points: number
  options: { id: string; text: string }[]
  selectedOptionId: string | null
  correctOptionId: string
  earned: number
}

export type SaveAnswerRequest = { selectedOptionId: string | null }
export type SaveAnswerResponse = { questionId: string; selectedOptionId: string | null; savedAt: string }

// ---- Teacher ----

export type TeacherClassRoom = { id: string; name: string; studentCount: number }

export type TeacherQuizSummary = {
  id: string
  title: string
  classRooms: ClassRoomRef[]
  opensAt: string
  closesAt: string
  durationMinutes: number
  wrongAnswerPenaltyPercent: number
  isPublished: boolean
  state: TeacherQuizState
  isLocked: boolean
  questionCount: number
  maxScore: number
  assignedStudentCount: number
  startedCount: number
  finalizedCount: number
}

export type QuizUpsert = {
  title: string
  description: string | null
  classRoomIds: string[]
  /** UTC ISO; the browser converts from local input */
  opensAt: string
  closesAt: string
  durationMinutes: number
  wrongAnswerPenaltyPercent: number
  /** order = array order */
  questions: { text: string; points: number; options: { text: string; isCorrect: boolean }[] }[]
}

export type QuizEditorView = Omit<QuizUpsert, 'questions' | 'classRoomIds'> & {
  id: string
  classRooms: ClassRoomRef[]
  isPublished: boolean
  state: TeacherQuizState
  isLocked: boolean
  maxScore: number
  questions: {
    id: string
    order: number
    text: string
    points: number
    options: { id: string; order: number; text: string; isCorrect: boolean }[]
  }[]
}

export type QuizResults = {
  quiz: {
    id: string
    title: string
    opensAt: string
    closesAt: string
    durationMinutes: number
    wrongAnswerPenaltyPercent: number
    maxScore: number
    state: TeacherQuizState
  }
  summary: {
    assignedCount: number
    startedCount: number
    finalizedCount: number
    averageScore: number | null
    highestScore: number | null
    lowestScore: number | null
    averagePercentage: number | null
  }
  /** ordered by classRoom, then fullName */
  rows: {
    studentId: string
    fullName: string
    username: string
    classRoom: string
    status: ResultRowStatus
    attemptId: string | null
    startedAt: string | null
    finalizedAt: string | null
    score: number | null
    maxScore: number
    percentage: number | null
  }[]
}
