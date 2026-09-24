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
  /** Set when a wrong answer costs a fixed number of points instead (then the percentage is 0). */
  wrongAnswerPenaltyPoints: number | null
  status: StudentQuizStatus
  /** Only when Available: min(duration, minutes until close), rounded down. */
  effectiveMinutesIfStartedNow: number | null
  /** `score` is null while the attempt runs and whenever the teacher hides scores (`scoreVisible` false). */
  attempt: { id: string; status: AttemptStatus; deadline: string; scoreVisible: boolean; score: number | null; maxScore: number } | null
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
  /** Set when a wrong answer costs a fixed number of points instead (then the percentage is 0). */
  wrongAnswerPenaltyPoints: number | null
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
  /** False when the teacher hides scores: every graded value below is then null (the server doesn't send it). */
  scoreVisible: boolean
  score: number | null
  maxScore: number | null
  percentage: number | null
  correctCount: number | null
  wrongCount: number | null
  unansweredCount: number | null
  /** When the teacher corrected the closed quiz and this result changed. */
  regradedAt: string | null
  wrongAnswerPenaltyPercent: number
  /** Set when a wrong answer costs a fixed number of points instead (then the percentage is 0). */
  wrongAnswerPenaltyPoints: number | null
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
  /** Set when a wrong answer costs a fixed number of points instead (then the percentage is 0). */
  wrongAnswerPenaltyPoints: number | null
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
  /** Set when a wrong answer costs a fixed number of points instead (then the percentage is 0). */
  wrongAnswerPenaltyPoints: number | null
  scoresVisibleToStudents: boolean
  /** order = array order; `id` keeps an existing question/option (and students' answers to it) when editing */
  questions: { id: string | null; text: string; points: number; options: { id: string | null; text: string; isCorrect: boolean }[] }[]
}

export type QuizEditorView = Omit<QuizUpsert, 'questions' | 'classRoomIds'> & {
  id: string
  classRooms: ClassRoomRef[]
  isPublished: boolean
  state: TeacherQuizState
  /** Students have attempts and the quiz is still open: nothing can change. */
  isLocked: boolean
  /** With `!isLocked`: closed with attempts. Content and marking can change (saving regrades); schedule and classes can't. */
  hasAttempts: boolean
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
    /** Set when a wrong answer costs a fixed number of points instead (then the percentage is 0). */
    wrongAnswerPenaltyPoints: number | null
    maxScore: number
    state: TeacherQuizState
    scoresVisibleToStudents: boolean
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
    regradedAt: string | null
  }[]
}

export type AnswerOutcome = 'Correct' | 'Wrong' | 'Unanswered'

/** One student's answers for the quiz's teacher, scored by the quiz as it is now (`score` is the stored result). */
export type TeacherAttemptDetail = {
  attemptId: string
  quizId: string
  quizTitle: string
  student: { id: string; fullName: string; username: string; classRoom: string | null }
  status: AttemptStatus
  startedAt: string
  deadline: string
  finalizedAt: string | null
  regradedAt: string | null
  score: number | null
  maxScore: number
  percentage: number | null
  correctCount: number
  wrongCount: number
  unansweredCount: number
  /** The questions' contributions added up, before the total is kept at 0 or more. */
  questionsTotal: number
  wrongAnswerPenaltyPercent: number
  wrongAnswerPenaltyPoints: number | null
  scoresVisibleToStudents: boolean
  questions: {
    questionId: string
    order: number
    text: string
    points: number
    options: { id: string; order: number; text: string; isCorrect: boolean }[]
    selectedOptionId: string | null
    /** The chosen option's text when the teacher removed it later (the answer then counts as unanswered). */
    removedSelectionText: string | null
    outcome: AnswerOutcome
    earned: number
    deduction: number
    contribution: number
  }[]
}
