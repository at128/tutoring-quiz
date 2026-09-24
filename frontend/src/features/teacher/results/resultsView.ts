import type { QuizResults } from '../../../api/types'
import type { Messages } from '../../../i18n/en'
import type { Lang } from '../../../i18n/lang'
import { roundAwayFromZero } from '../../../lib/format'

// Pure view logic for the teacher's results: the class filter and sort are client-side over `rows`
// (the API summary always covers every assigned class).

export type ResultRow = QuizResults['rows'][number]
export type SortKey = 'class' | 'name' | 'scoreHigh' | 'scoreLow'

export const SORT_KEYS: SortKey[] = ['class', 'name', 'scoreHigh', 'scoreLow']

export const ALL = 'all'

/** "All (40)", "10A (20)", … in the order classes first appear (rows come sorted by class). */
export function classFilters(rows: ResultRow[], m: Messages['results']): { value: string; label: string }[] {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.classRoom, (counts.get(row.classRoom) ?? 0) + 1)
  return [{ value: ALL, label: m.all(rows.length) }, ...[...counts].map(([name, count]) => ({ value: name, label: m.classFilter(name, count) }))]
}

export const filterRows = (rows: ResultRow[], classRoom: string) =>
  classRoom === ALL ? rows : rows.filter((row) => row.classRoom === classRoom)

type Compare = (a: ResultRow, b: ResultRow) => number

// Names sort by the interface language's alphabet (Arabic names in Arabic order), class codes and usernames by code.
const collators: Record<Lang, Intl.Collator> = { en: new Intl.Collator('en'), ar: new Intl.Collator('ar') }
const codes = new Intl.Collator('en', { numeric: true })

const nameOrder = (lang: Lang): Compare => (a, b) =>
  collators[lang].compare(a.fullName, b.fullName) || codes.compare(a.username, b.username)
const classOrder = (lang: Lang): Compare => (a, b) => codes.compare(a.classRoom, b.classRoom) || nameOrder(lang)(a, b)

/** Rows without a score always go last, whichever direction the scores are sorted. */
function scoreOrder(direction: 1 | -1, lang: Lang): Compare {
  return (a, b) => {
    if (a.score === null && b.score === null) return classOrder(lang)(a, b)
    if (a.score === null) return 1
    if (b.score === null) return -1
    return (a.score - b.score) * direction || classOrder(lang)(a, b)
  }
}

export function sortRows(rows: ResultRow[], sort: SortKey, lang: Lang): ResultRow[] {
  const compare =
    sort === 'name' ? nameOrder(lang) : sort === 'scoreHigh' ? scoreOrder(-1, lang) : sort === 'scoreLow' ? scoreOrder(1, lang) : classOrder(lang)
  return [...rows].sort(compare)
}

export type StatusCounts = { inProgress: number; submitted: number; expired: number; missed: number; notStarted: number }

export function statusCounts(rows: ResultRow[]): StatusCounts {
  const counts: StatusCounts = { inProgress: 0, submitted: 0, expired: 0, missed: 0, notStarted: 0 }
  for (const row of rows) {
    if (row.status === 'InProgress') counts.inProgress++
    else if (row.status === 'Submitted') counts.submitted++
    else if (row.status === 'Expired') counts.expired++
    else if (row.status === 'Missed') counts.missed++
    else counts.notStarted++
  }
  return counts
}

/** Percentage of the maximum, for display next to a server-computed score. */
export const percentOf = (score: number | null, maxScore: number) =>
  score === null || maxScore === 0 ? null : roundAwayFromZero((score / maxScore) * 100, 1)

export const showingLine = (count: number, classRoom: string, m: Messages['results']) =>
  classRoom === ALL ? m.showingAll(count) : m.showingClass(count, classRoom)
