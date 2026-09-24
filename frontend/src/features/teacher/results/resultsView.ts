import type { QuizResults } from '../../../api/types'
import { roundAwayFromZero } from '../../../lib/format'

// Pure view logic for the teacher's results: the class filter and sort are client-side over `rows`
// (the API summary always covers every assigned class).

export type ResultRow = QuizResults['rows'][number]
export type SortKey = 'class' | 'name' | 'scoreHigh' | 'scoreLow'

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'class', label: 'Class, then name' },
  { value: 'name', label: 'Name' },
  { value: 'scoreHigh', label: 'Score, highest first' },
  { value: 'scoreLow', label: 'Score, lowest first' },
]

export const ALL = 'all'

/** "All (40)", "10A (20)", … in the order classes first appear (rows come sorted by class). */
export function classFilters(rows: ResultRow[]): { value: string; label: string }[] {
  const counts = new Map<string, number>()
  for (const row of rows) counts.set(row.classRoom, (counts.get(row.classRoom) ?? 0) + 1)
  return [{ value: ALL, label: `All (${rows.length})` }, ...[...counts].map(([name, count]) => ({ value: name, label: `${name} (${count})` }))]
}

export const filterRows = (rows: ResultRow[], classRoom: string) =>
  classRoom === ALL ? rows : rows.filter((row) => row.classRoom === classRoom)

const byName = (a: ResultRow, b: ResultRow) => a.fullName.localeCompare(b.fullName) || a.username.localeCompare(b.username)
const byClass = (a: ResultRow, b: ResultRow) => a.classRoom.localeCompare(b.classRoom) || byName(a, b)

/** Rows without a score always go last, whichever direction the scores are sorted. */
function byScore(direction: 1 | -1) {
  return (a: ResultRow, b: ResultRow) => {
    if (a.score === null && b.score === null) return byClass(a, b)
    if (a.score === null) return 1
    if (b.score === null) return -1
    return (a.score - b.score) * direction || byClass(a, b)
  }
}

export function sortRows(rows: ResultRow[], sort: SortKey): ResultRow[] {
  const compare = sort === 'name' ? byName : sort === 'scoreHigh' ? byScore(-1) : sort === 'scoreLow' ? byScore(1) : byClass
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

export const showingLine = (count: number, classRoom: string) =>
  classRoom === ALL ? `Showing all ${count} students` : `Showing ${count} student${count === 1 ? '' : 's'} in ${classRoom}`
