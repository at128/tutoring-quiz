import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AttemptResult, QuizEditorView, TeacherQuizSummary } from '../api/types'
import { scoringExplanation } from '../features/student/resultCopy'
import { isBlank, localizeServerProblems, problemLines, statusSentence, validate, type EditorValues } from '../features/teacher/editor/editorForm'
import { classFilters, showingLine, sortRows, type ResultRow } from '../features/teacher/results/resultsView'
import { progressOf } from '../features/teacher/teacherCopy'
import { formatDateTime, formatDateTimeWithYear, formatDayTime, formatLongDate, formatMinutes, formatRelative, formatShortDate } from '../lib/time'
import { ar } from './ar'
import { stripIsolates } from './bidi'
import { en } from './en'

// Edge cases of the Arabic interface, screen by screen. Amman time (UTC+3 all year) for deterministic dates.
afterEach(() => vi.unstubAllEnvs())
const amman = () => vi.stubEnv('TZ', 'Asia/Amman')

describe('Arabic dates and times', () => {
  it('writes dates with Arabic day and month names, Western digits and an Arabic comma', () => {
    amman()
    expect(formatDateTime('2026-10-08T07:00:00Z', 'ar')).toBe('الخميس 8 أكتوبر، 10:00')
    expect(formatDateTimeWithYear('2026-09-23T07:00:00Z', 'ar')).toBe('الأربعاء 23 سبتمبر 2026، 10:00')
    expect(formatShortDate('2026-09-18T07:00:00Z', 'ar')).toBe('الجمعة 18 سبتمبر')
    expect(formatLongDate(Date.parse('2026-09-24T07:00:00Z'), 'ar')).toBe('الخميس 24 سبتمبر')
    expect(formatDateTime('2026-10-08T07:00:00Z', 'en')).toBe('Thu 8 Oct, 10:00')
  })

  it('uses every month and weekday name (no gaps in the lists)', () => {
    amman()
    const months = Array.from({ length: 12 }, (_, m) => formatShortDate(new Date(Date.UTC(2026, m, 15, 9)).toISOString(), 'ar').split(' ')[2])
    expect(months).toEqual(['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'])
    const days = Array.from({ length: 7 }, (_, d) => formatShortDate(new Date(Date.UTC(2026, 8, 20 + d, 9)).toISOString(), 'ar').split(' ')[0])
    expect(days).toEqual(['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'])
  })

  it('says today and tomorrow in the viewer’s own day, including just after local midnight', () => {
    amman()
    const now = Date.parse('2026-09-24T21:30:00Z') // 00:30 on 25 Sep in Amman
    expect(formatDayTime('2026-09-24T22:00:00Z', now, 'ar')).toBe('اليوم، 01:00')
    expect(formatDayTime('2026-09-25T22:00:00Z', now, 'ar')).toBe('غدًا، 01:00')
    expect(formatDayTime('2026-09-27T07:00:00Z', now, 'ar')).toBe('الأحد 27 سبتمبر، 10:00')
  })

  it.each([
    ['2026-09-26T10:00:00Z', 'بعد يومين'],
    ['2026-09-25T10:00:00Z', 'غدًا'],
    ['2026-09-23T10:00:00Z', 'أمس'],
    ['2026-09-29T10:00:00Z', 'بعد 5 أيام'],
    ['2026-10-08T10:00:00Z', 'بعد 14 يومًا'],
    ['2026-09-24T13:00:00Z', 'بعد 3 ساعات'],
    ['2026-09-24T11:00:00Z', 'بعد ساعة'],
    ['2026-09-24T08:00:00Z', 'منذ ساعتين'],
    ['2026-09-24T10:11:00Z', 'بعد 11 دقيقة'],
    ['2026-09-24T10:01:00Z', 'بعد دقيقة'],
    ['2026-09-24T10:00:20Z', 'الآن'],
  ])('%s relative to 10:00 → %s', (iso, expected) => {
    expect(formatRelative(iso, Date.parse('2026-09-24T10:00:00Z'), 'ar')).toBe(expected)
  })

  it('counts minutes like Arabic does', () => {
    expect(formatMinutes(1, 'ar')).toBe('دقيقة واحدة')
    expect(formatMinutes(2, 'ar')).toBe('دقيقتان')
    expect(formatMinutes(5, 'ar')).toBe('5 دقائق')
    expect(formatMinutes(20, 'ar')).toBe('20 دقيقة')
    expect(formatMinutes(90, 'ar')).toBe('1 س 30 د')
    expect(formatMinutes(120, 'ar')).toBe('2 س')
  })
})

const valid = (): EditorValues => ({
  title: 'اختبار القواعد',
  description: '',
  classRoomIds: ['c'],
  opensAt: '2026-09-25T10:00',
  closesAt: '2026-10-01T10:00',
  stored: { opensAt: null, closesAt: null },
  durationMinutes: '20',
  penalty: '25',
  customPenalty: '',
  questions: [{ uid: 'q', text: 'ما إعراب «الطالبُ»؟', points: '2', correct: '0', options: [{ text: 'مبتدأ' }, { text: 'خبر' }] }],
})

describe('Arabic quiz editor', () => {
  const NOW = Date.parse('2026-09-24T09:00:00Z')

  it('explains every problem in Arabic, on the same fields as the server', () => {
    const values = valid()
    values.title = 'ab'
    values.questions[0] = { ...values.questions[0], correct: '', options: [{ text: 'مبتدأ' }, { text: '  ' }] }
    const problems = validate(values, 'publish', NOW, ar.editor)
    expect(problems.title).toEqual([ar.editor.titleLength(3, 200)])
    expect(problems['questions[0].options']).toEqual([ar.editor.needsCorrect])
    expect(problems['questions[0].options[1].text']).toEqual(['اكتب هذا الخيار.'])
    expect(problemLines(problems, ar.editor)).toEqual([ar.editor.titleLength(3, 200), 'السؤال 1 يحتاج إجابة صحيحة.', 'السؤال 1: اكتب هذا الخيار.'])
  })

  it('counts an Arabic title with diacritics by its characters, like the server', () => {
    const values = valid()
    values.title = 'مَا'.padEnd(200, 'ً') // 200 UTF-16 units, diacritics included
    expect(validate(values, 'save', NOW, ar.editor).title).toBeUndefined()
    values.title += 'ً'
    expect(validate(values, 'save', NOW, ar.editor).title).toEqual([ar.editor.titleLength(3, 200)])
  })

  it('treats whitespace-only Arabic text (tabs, no-break spaces) as empty', () => {
    const values = valid()
    values.questions[0].text = '  \t '
    expect(validate(values, 'save', NOW, ar.editor)['questions[0].text']).toEqual(['اكتب السؤال.'])
  })

  it.each([
    ['tatweel only', 'ـــ'],
    ['diacritics on tatweel', 'ـَـِ'],
    ['ZWNJ and no-break space', '‌ ‌'],
    ['a right-to-left mark', '‏'],
    ['line and paragraph separators', '  '],
  ])('treats %s as blank, like the server', (_, text) => {
    expect(isBlank(text)).toBe(true)
    const values = valid()
    values.questions[0].text = text
    values.questions[0].options[1].text = text
    values.title = `${text}${text}${text}`
    const problems = validate(values, 'save', NOW, ar.editor)
    expect(problems['questions[0].text']).toEqual(['اكتب السؤال.'])
    expect(problems['questions[0].options[1].text']).toEqual(['اكتب هذا الخيار.'])
    expect(problems.title).toEqual([ar.editor.titleLength(3, 200)])
  })

  it.each([['؟'], ['٣'], ['3'], ['كتـــاب'], ['😀']])('keeps %s as real content', (text) => {
    expect(isBlank(text)).toBe(false)
  })

  it('shows its own Arabic words for problems only the server caught (the server writes English)', () => {
    const client = { title: [ar.editor.titleLength(3, 200)] }
    const server = { title: ['Title must be 3–200 characters.'], closesAt: ['Closing time is in the past.'] }
    expect(localizeServerProblems(server, client, ar)).toEqual({ title: [ar.editor.titleLength(3, 200)], closesAt: [ar.editor.checkField] })
    expect(localizeServerProblems(server, client, en)).toEqual(server)
  })

  it('states where the quiz stands in Arabic, joining class names with و', () => {
    amman()
    const view = {
      state: 'Scheduled',
      opensAt: '2026-09-26T07:00:00Z',
      closesAt: '2026-10-01T07:00:00Z',
      classRooms: [
        { id: 'a', name: '10A' },
        { id: 'b', name: '10B' },
      ],
    } as QuizEditorView
    expect(statusSentence(view, ar, 'ar')).toBe('منشور. يستطيع طلاب 10A و10B بدءه من السبت 26 سبتمبر، 10:00.')
    expect(statusSentence(null, ar, 'ar')).toBe(ar.editor.statusDraft)
  })
})

const row = (fullName: string, classRoom: string, score: number | null, username = fullName): ResultRow =>
  ({ studentId: fullName, fullName, username, classRoom, status: score === null ? 'NotStarted' : 'Submitted', score, maxScore: 10, startedAt: null, finalizedAt: null, attemptId: null }) as ResultRow

describe('Arabic results', () => {
  const rows = [row('يوسف خالد', '10A', 7, '10a-02'), row('أحمد علي', '10A', 9, '10a-01'), row('بلال سمير', '10B', null, '10b-01'), row('Lina Haddad', '10B', 5, '10b-02')]

  it('sorts Arabic names in Arabic alphabetical order', () => {
    const names = sortRows(rows, 'name', 'ar').map((r) => r.fullName)
    expect(names.indexOf('أحمد علي')).toBeLessThan(names.indexOf('بلال سمير'))
    expect(names.indexOf('بلال سمير')).toBeLessThan(names.indexOf('يوسف خالد'))
  })

  it('keeps unscored students last whatever the language', () => {
    expect(sortRows(rows, 'scoreHigh', 'ar').at(-1)?.fullName).toBe('بلال سمير')
    expect(sortRows(rows, 'scoreLow', 'ar').at(-1)?.fullName).toBe('بلال سمير')
  })

  it('labels filters and counts in Arabic', () => {
    expect(classFilters(rows, ar.results).map((f) => stripIsolates(f.label))).toEqual(['الكل (4)', '10A (2)', '10B (2)'])
    expect(stripIsolates(showingLine(2, '10A', ar.results))).toBe('طالبان في الصف 10A')
    expect(showingLine(4, 'all', ar.results)).toBe('جميع الطلاب (4)')
  })

  it('shows teacher progress in Arabic', () => {
    const quiz = { state: 'Open', startedCount: 3, finalizedCount: 2, assignedStudentCount: 40, opensAt: '', closesAt: '' } as unknown as TeacherQuizSummary
    expect(progressOf(quiz, 0, ar, 'ar')).toEqual({ value: '2 من 40', caption: 'أنهوا الاختبار' })
  })
})

describe('Arabic result explanation', () => {
  const result = (score: number, wrongCount: number, penalty: number) => ({ score, wrongCount, wrongAnswerPenaltyPercent: penalty }) as AttemptResult

  it('covers no marking, a score stopped at zero, no wrong answers and some wrong answers', () => {
    expect(scoringExplanation(result(5, 2, 0), ar)).toBe(ar.result.noMarking)
    expect(stripIsolates(scoringExplanation(result(0, 6, 25), ar))).toBe(
      'في هذا الاختبار علامات سالبة: كل إجابة خاطئة خسرت 25% من علامة سؤالها. خصمت إجاباتك الخاطئة ما يساوي العلامات التي حصلت عليها أو أكثر، والعلامة لا تنزل أبدًا عن صفر.',
    )
    // Zero with no wrong answers (nothing answered) is not a deduction.
    expect(scoringExplanation(result(0, 0, 25), ar)).toContain(ar.result.noWrong)
    expect(scoringExplanation(result(0, 2, 0), ar)).toBe(ar.result.noMarking)
    expect(scoringExplanation(result(10, 0, 25), ar)).toContain(ar.result.noWrong)
    expect(scoringExplanation(result(7, 3, 25), ar)).toContain('الإجابات الخاطئة (3)')
  })
})
