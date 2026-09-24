import { describe, expect, it } from 'vitest'
import { en } from '../../../i18n/en'
import { ALL, classFilters, filterRows, percentOf, sortRows, statusCounts, type ResultRow } from './resultsView'

const row = (fullName: string, classRoom: string, status: ResultRow['status'], score: number | null): ResultRow => ({
  studentId: fullName,
  fullName,
  username: fullName.toLowerCase(),
  classRoom,
  status,
  attemptId: score === null ? null : `a-${fullName}`,
  startedAt: null,
  finalizedAt: null,
  score,
  maxScore: 10,
  percentage: score === null ? null : score * 10,
})

const rows = [
  row('Omar', '10A', 'Submitted', 7),
  row('Lara', '10A', 'NotStarted', null),
  row('Sara', '10B', 'Expired', -1.5),
  row('Adam', '10B', 'Submitted', 9),
  row('Maya', '10B', 'InProgress', null),
]

describe('filters and sorting', () => {
  it('offers All plus each class with its count', () => {
    expect(classFilters(rows, en.results)).toEqual([
      { value: ALL, label: 'All (5)' },
      { value: '10A', label: '10A (2)' },
      { value: '10B', label: '10B (3)' },
    ])
    expect(filterRows(rows, '10A').map((r) => r.fullName)).toEqual(['Omar', 'Lara'])
    expect(filterRows(rows, ALL)).toHaveLength(5)
  })

  it('sorts by class then name by default', () => {
    expect(sortRows(rows, 'class', 'en').map((r) => r.fullName)).toEqual(['Lara', 'Omar', 'Adam', 'Maya', 'Sara'])
  })

  it('sorts by score both ways and keeps unscored students last', () => {
    expect(sortRows(rows, 'scoreHigh', 'en').map((r) => r.fullName)).toEqual(['Adam', 'Omar', 'Sara', 'Lara', 'Maya'])
    expect(sortRows(rows, 'scoreLow', 'en').map((r) => r.fullName)).toEqual(['Sara', 'Omar', 'Adam', 'Lara', 'Maya'])
  })

  it('does not change the input order', () => {
    const before = rows.map((r) => r.fullName)
    sortRows(rows, 'name', 'en')
    expect(rows.map((r) => r.fullName)).toEqual(before)
  })
})

describe('summary helpers', () => {
  it('counts each status', () => {
    expect(statusCounts(rows)).toEqual({ inProgress: 1, submitted: 2, expired: 1, missed: 0, notStarted: 1 })
  })

  it('works out a display percentage, including negative scores', () => {
    expect(percentOf(-1.5, 24)).toBe(-6.3)
    expect(percentOf(null, 24)).toBeNull()
  })
})
