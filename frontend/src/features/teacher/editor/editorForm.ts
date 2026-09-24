import type { QuizEditorView, QuizUpsert } from '../../../api/types'
import { formatDateTime } from '../../../lib/time'

// Pure model of the quiz editor: form values ⇄ API request, and validation that mirrors the server's rules
// (docs/DOMAIN.md → Validation limits). Problems are keyed exactly like the server's `errors`
// (`title`, `questions[2].options`, …) so client and server messages land on the same fields.

export type PenaltyChoice = '0' | '25' | '33' | '50' | 'custom'
export const PENALTY_PRESETS: PenaltyChoice[] = ['0', '25', '33', '50']

export type OptionValues = { text: string }
/** `uid` only identifies the question inside the editor (open/closed state); it is never sent. */
export type QuestionValues = { uid: string; text: string; points: string; correct: string; options: OptionValues[] }
export type EditorValues = {
  title: string
  description: string
  classRoomIds: string[]
  /** datetime-local strings in the teacher's local time */
  opensAt: string
  closesAt: string
  /** The saved UTC instants behind opensAt/closesAt, which may carry seconds; see `instantOf`. */
  stored: StoredTimes
  durationMinutes: string
  penalty: PenaltyChoice
  customPenalty: string
  questions: QuestionValues[]
}

export type StoredTimes = { opensAt: string | null; closesAt: string | null }

export type Problems = Record<string, string[]>
export type Intent = 'save' | 'publish'

export const LIMITS = {
  titleMin: 3,
  titleMax: 200,
  descriptionMax: 1000,
  durationMin: 1,
  durationMax: 180,
  questionsMax: 100,
  questionTextMax: 2000,
  pointsMin: 1,
  pointsMax: 100,
  optionsMin: 2,
  optionsMax: 6,
  optionTextMax: 500,
} as const

// ---- time ----

const pad = (n: number) => String(n).padStart(2, '0')

/** UTC ISO → "2026-09-26T10:00" in the viewer's time zone (for <input type="datetime-local">). */
export function toLocalInput(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** "2026-09-26T10:00" (local) → UTC ISO with Z, or null when empty/invalid. */
export function fromLocalInput(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  const iso = date.toISOString()
  return toLocalInput(iso) === value ? iso : null
}

/**
 * The instant a time field stands for. While the teacher hasn't changed the minute shown, it's the stored
 * instant (seconds included), so opening and saving a quiz never shifts its times; otherwise it's what they typed.
 */
export function instantOf(local: string, stored: string | null): string | null {
  return stored !== null && toLocalInput(stored) === local ? stored : fromLocalInput(local)
}

/** "Amman time" from the browser's time zone. */
export function localTimeZoneLabel(): string {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''
  const city = zone.split('/').pop()?.replaceAll('_', ' ')
  return city ? `${city} time` : 'Local time'
}

// ---- mapping ----

export const emptyQuestion = (): QuestionValues => ({
  uid: crypto.randomUUID(),
  text: '',
  points: '1',
  correct: '',
  options: [{ text: '' }, { text: '' }, { text: '' }, { text: '' }],
})

/** A new quiz: opens tomorrow at 10:00, closes a week later, 20 minutes, no negative marking. */
export function emptyForm(nowMs: number): EditorValues {
  const opens = new Date(nowMs + 24 * 3600_000)
  opens.setHours(10, 0, 0, 0)
  const closes = new Date(opens.getTime() + 7 * 24 * 3600_000)
  return {
    title: '',
    description: '',
    classRoomIds: [],
    opensAt: toLocalInput(opens.toISOString()),
    closesAt: toLocalInput(closes.toISOString()),
    stored: { opensAt: null, closesAt: null },
    durationMinutes: '20',
    penalty: '0',
    customPenalty: '',
    questions: [emptyQuestion()],
  }
}

export function fromView(view: QuizEditorView): EditorValues {
  const preset = PENALTY_PRESETS.find((p) => Number(p) === view.wrongAnswerPenaltyPercent)
  return {
    title: view.title,
    description: view.description ?? '',
    classRoomIds: view.classRooms.map((c) => c.id),
    opensAt: toLocalInput(view.opensAt),
    closesAt: toLocalInput(view.closesAt),
    stored: { opensAt: view.opensAt, closesAt: view.closesAt },
    durationMinutes: String(view.durationMinutes),
    penalty: preset ?? 'custom',
    customPenalty: preset ? '' : String(view.wrongAnswerPenaltyPercent),
    questions: [...view.questions]
      .sort((a, b) => a.order - b.order)
      .map((q) => {
        const options = [...q.options].sort((a, b) => a.order - b.order)
        const correct = options.findIndex((o) => o.isCorrect)
        return {
          uid: q.id,
          text: q.text,
          points: String(q.points),
          correct: correct >= 0 ? String(correct) : '',
          options: options.map((o) => ({ text: o.text })),
        }
      }),
  }
}

const toInt = (value: string): number | null => (/^-?\d+$/.test(value.trim()) ? Number(value.trim()) : null)

export const penaltyPercent = (values: Pick<EditorValues, 'penalty' | 'customPenalty'>): number | null =>
  values.penalty === 'custom' ? toInt(values.customPenalty) : Number(values.penalty)

/** Only called once validation passed, so every number parses. */
export function toUpsert(values: EditorValues): QuizUpsert {
  return {
    title: values.title.trim(),
    description: values.description.trim() || null,
    classRoomIds: values.classRoomIds,
    opensAt: instantOf(values.opensAt, values.stored.opensAt) ?? '',
    closesAt: instantOf(values.closesAt, values.stored.closesAt) ?? '',
    durationMinutes: toInt(values.durationMinutes) ?? 0,
    wrongAnswerPenaltyPercent: penaltyPercent(values) ?? 0,
    questions: values.questions.map((q) => ({
      text: q.text.trim(),
      points: toInt(q.points) ?? 0,
      options: q.options.map((o, j) => ({ text: o.text.trim(), isCorrect: String(j) === q.correct })),
    })),
  }
}

// ---- validation ----

export const NEEDS_CORRECT = 'Choose the correct answer for this question.'
/** A filled-in date/time that the calendar or a daylight-saving jump rules out (never silently shifted). */
export const NOT_A_REAL_TIME = 'That date and time doesn’t exist in your time zone. Choose another.'

export function validate(values: EditorValues, intent: Intent, nowMs: number): Problems {
  const problems: Problems = {}
  const add = (key: string, message: string) => {
    problems[key] = [...(problems[key] ?? []), message]
  }

  const title = values.title.trim()
  if (title.length < LIMITS.titleMin || title.length > LIMITS.titleMax)
    add('title', `Title must be ${LIMITS.titleMin}–${LIMITS.titleMax} characters.`)
  if (values.description.trim().length > LIMITS.descriptionMax)
    add('description', `Description can be at most ${LIMITS.descriptionMax} characters.`)
  if (values.classRoomIds.length === 0) add('classRoomIds', 'Choose at least one class.')

  const opens = instantOf(values.opensAt, values.stored.opensAt)
  const closes = instantOf(values.closesAt, values.stored.closesAt)
  if (!opens) add('opensAt', values.opensAt === '' ? 'Choose when the quiz opens.' : NOT_A_REAL_TIME)
  if (!closes) add('closesAt', values.closesAt === '' ? 'Choose when the quiz closes.' : NOT_A_REAL_TIME)
  else if (opens && Date.parse(closes) <= Date.parse(opens)) add('closesAt', 'Must be after the opening time.')
  else if (intent === 'publish' && Date.parse(closes) <= nowMs) add('closesAt', 'The closing time must be in the future.')

  const duration = toInt(values.durationMinutes)
  if (duration === null || duration < LIMITS.durationMin || duration > LIMITS.durationMax)
    add('durationMinutes', `Time limit must be ${LIMITS.durationMin}–${LIMITS.durationMax} minutes.`)

  const penalty = penaltyPercent(values)
  if (penalty === null || penalty < 0 || penalty > 100) add('wrongAnswerPenaltyPercent', 'Negative marking must be a whole number from 0 to 100.')

  if (values.questions.length > LIMITS.questionsMax) add('questions', `A quiz can have at most ${LIMITS.questionsMax} questions.`)
  if (intent === 'publish' && values.questions.length === 0) add('questions', 'Add at least one question before publishing.')

  values.questions.forEach((q, i) => {
    const prefix = `questions[${i}]`
    const text = q.text.trim()
    if (text.length === 0) add(`${prefix}.text`, 'Write the question.')
    else if (text.length > LIMITS.questionTextMax) add(`${prefix}.text`, `Questions can be at most ${LIMITS.questionTextMax} characters.`)

    const points = toInt(q.points)
    if (points === null || points < LIMITS.pointsMin || points > LIMITS.pointsMax)
      add(`${prefix}.points`, `Points must be a whole number from ${LIMITS.pointsMin} to ${LIMITS.pointsMax}.`)

    if (q.options.length < LIMITS.optionsMin || q.options.length > LIMITS.optionsMax)
      add(`${prefix}.options`, `A question needs ${LIMITS.optionsMin}–${LIMITS.optionsMax} options.`)
    const correct = toInt(q.correct)
    if (correct === null || correct < 0 || correct >= q.options.length) add(`${prefix}.options`, NEEDS_CORRECT)

    q.options.forEach((o, j) => {
      const optionText = o.text.trim()
      if (optionText.length === 0) add(`${prefix}.options[${j}].text`, 'Write this option.')
      else if (optionText.length > LIMITS.optionTextMax)
        add(`${prefix}.options[${j}].text`, `Options can be at most ${LIMITS.optionTextMax} characters.`)
    })
  })

  return problems
}

// ---- problems → words ----

const QUESTION_KEY = /^questions\[(\d+)\]/

/** Index of the question a problem key belongs to, or null for quiz-level keys. */
export const questionIndexOf = (key: string): number | null => {
  const match = QUESTION_KEY.exec(key)
  return match ? Number(match[1]) : null
}

/** Problems of one question (its text, points, options and option texts). */
export const problemsOfQuestion = (problems: Problems, index: number) =>
  Object.entries(problems).filter(([key]) => questionIndexOf(key) === index)

/** One readable line per problem for the summary banner ("Question 2 needs a correct answer."). */
export function problemLines(problems: Problems): string[] {
  const lines = new Set<string>()
  for (const [key, messages] of Object.entries(problems)) {
    const index = questionIndexOf(key)
    for (const message of messages) {
      if (index === null) lines.add(message)
      else if (message === NEEDS_CORRECT) lines.add(`Question ${index + 1} needs a correct answer.`)
      else lines.add(`Question ${index + 1}: ${message}`)
    }
  }
  return [...lines]
}

/** "10A and 10B", "10A, 10B and 11A". */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

/** Where the quiz stands, in one sentence (uses the saved quiz, not unsaved edits). */
export function statusSentence(view: QuizEditorView | null): string {
  if (!view || view.state === 'Draft') return 'Draft. Only you can see it until you publish it.'
  const classes = joinNames(view.classRooms.map((c) => c.name))
  switch (view.state) {
    case 'Scheduled':
      return `Published. Students in ${classes} can start it from ${formatDateTime(view.opensAt)}.`
    case 'Open':
      return `Published and open. Students in ${classes} can start it until ${formatDateTime(view.closesAt)}.`
    case 'Closed':
      return `Closed ${formatDateTime(view.closesAt)}. No student started it.`
  }
}
