import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { isApiError } from '../../api/client'
import { getQuizResults, teacherKeys } from '../../api/teacher'
import type { QuizResults } from '../../api/types'
import { Num } from '../../components/Auto'
import { Badge } from '../../components/Badge'
import { Button } from '../../components/Button'
import { Segmented } from '../../components/ClassChip'
import { Icon } from '../../components/Icon'
import { BackLink, PageShell } from '../../components/PageShell'
import { EmptyState, ErrorState, NotAvailableState, Skeleton } from '../../components/States'
import { formatPercent, formatScore } from '../../lib/format'
import { formatDateTime, formatShortDate } from '../../lib/time'
import { localTimeZoneLabel } from './editor/editorForm'
import {
  ALL,
  classFilters,
  filterRows,
  percentOf,
  showingLine,
  SORT_OPTIONS,
  sortRows,
  statusCounts,
  type ResultRow,
  type SortKey,
} from './results/resultsView'

const BACK = { to: '/teacher', label: 'My quizzes' }
const MOBILE_PAGE = 10

/** Per-student results with a whole-quiz summary (prototype: "Quiz results", "Quiz results, mobile"). */
export function ResultsPage() {
  const { quizId = '' } = useParams()
  const results = useQuery({
    queryKey: teacherKeys.results(quizId),
    queryFn: ({ signal }) => getQuizResults(quizId, signal),
  })

  return (
    <PageShell width="teacher" mainClassName="gap-[18px] pt-5 pb-10 md:pt-8 md:pb-12">
      <BackLink {...BACK} />
      {results.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading results">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : results.isError ? (
        isApiError(results.error, 'not_found') ? (
          <NotAvailableState title="Quiz not found" backTo="/teacher" backLabel="Back to my quizzes">
            It may have been deleted, or it isn’t one of your quizzes.
          </NotAvailableState>
        ) : (
          <ErrorState error={results.error} onRetry={() => void results.refetch()} title="Couldn’t load the results" />
        )
      ) : (
        <Results data={results.data} refreshing={results.isFetching} onRefresh={() => void results.refetch()} />
      )}
    </PageShell>
  )
}

function Results({ data, refreshing, onRefresh }: { data: QuizResults; refreshing: boolean; onRefresh: () => void }) {
  const [classRoom, setClassRoom] = useState<string>(ALL)
  const [sort, setSort] = useState<SortKey>('class')
  const [showAll, setShowAll] = useState(false)
  const { quiz, summary } = data
  const rows = sortRows(filterRows(data.rows, classRoom), sort)
  const counts = statusCounts(data.rows)
  const classes = [...new Set(data.rows.map((r) => r.classRoom))]
  const closed = quiz.state === 'Closed'
  const marking = quiz.wrongAnswerPenaltyPercent === 0 ? 'no negative marking' : `−${quiz.wrongAnswerPenaltyPercent}% per wrong answer`
  const stat = (value: number | null) => (value === null ? '—' : formatScore(value))
  const statPercent = (value: number | null) => (value === null ? undefined : formatPercent(percentOf(value, quiz.maxScore) ?? 0))

  return (
    <>
      <div className="flex items-start justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex gap-2">
            <Badge kind={quiz.state} />
            {data.rows.some((r) => r.attemptId) && <Badge kind="Locked" />}
          </div>
          <h1 dir="auto" className="auto-text text-page leading-[1.3] font-bold md:text-display md:leading-[1.45]">
            {quiz.title}
          </h1>
          <p className="text-small leading-normal text-muted">
            Results · {closed ? `closed ${formatShortDate(quiz.closesAt)}` : `closes ${formatDateTime(quiz.closesAt)}`}
            <span className="hidden md:inline">
              {' '}
              · <Num>{quiz.durationMinutes}</Num> min · {marking}
            </span>{' '}
            · max <Num>{quiz.maxScore}</Num> points
          </p>
        </div>
        <Button variant="secondary" className="hidden flex-none md:inline-flex" loading={refreshing} onClick={onRefresh}>
          {!refreshing && <Icon name="refresh" className="size-[18px]" />}
          Refresh
        </Button>
      </div>

      {/* Summary covers every assigned class (the API's numbers); the filter below only affects the list. */}
      <div className="hidden grid-cols-6 rounded-sheet border border-rule bg-paper md:grid">
        <Tile label="Assigned" value={String(summary.assignedCount)} note={classes.join(' · ')} />
        <Tile label="Started" value={String(summary.startedCount)} note={`${counts.inProgress} in progress`} />
        <Tile label="Finalized" value={String(summary.finalizedCount)} note={`${counts.submitted} submitted · ${counts.expired} expired`} />
        <Tile
          label="Average"
          value={stat(summary.averageScore)}
          note={summary.averagePercentage === null ? undefined : `${formatPercent(summary.averagePercentage)} of ${quiz.maxScore}`}
        />
        <Tile label="Highest" value={stat(summary.highestScore)} note={statPercent(summary.highestScore)} />
        <Tile label="Lowest" value={stat(summary.lowestScore)} note={statPercent(summary.lowestScore)} />
      </div>
      <div className="grid grid-cols-3 rounded-sheet border border-rule bg-paper md:hidden">
        <Tile label="Assigned" value={String(summary.assignedCount)} />
        <Tile label="Finalized" value={String(summary.finalizedCount)} note={counts.expired > 0 ? `${counts.expired} expired` : undefined} />
        {closed ? (
          <Tile label="Missed" value={String(counts.missed)} />
        ) : (
          <Tile label="Started" value={String(summary.startedCount)} note={counts.inProgress > 0 ? `${counts.inProgress} in progress` : undefined} />
        )}
        <Tile label="Average" value={stat(summary.averageScore)} note={summary.averagePercentage === null ? undefined : formatPercent(summary.averagePercentage)} rowStart />
        <Tile label="Highest" value={stat(summary.highestScore)} />
        <Tile label="Lowest" value={stat(summary.lowestScore)} />
      </div>
      <p className="hidden text-small leading-normal text-muted md:block">
        Summary covers all assigned classes. Averages use finalized attempts only. Times are {localTimeZoneLabel()}.
      </p>

      {data.rows.length === 0 ? (
        <EmptyState icon="users" title="No students assigned">
          The classes on this quiz have no students yet.
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
            <div className="flex flex-col gap-1.5">
              <span className="text-small font-semibold">Class</span>
              <Segmented label="Filter by class" options={classFilters(data.rows)} value={classRoom} onChange={setClassRoom} className="md:w-[420px]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="results-sort" className="text-small font-semibold">
                Sort by
              </label>
              <select
                id="results-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="h-12 w-full rounded-control border border-strong bg-paper px-3 text-body text-ink md:h-11 md:w-[240px]"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-small leading-normal text-muted" aria-live="polite">
            {showingLine(rows.length, classRoom)}
          </p>

          <ResultsTable rows={rows} maxScore={quiz.maxScore} classRoom={classRoom} sort={sort} onSort={setSort} />

          <div className="flex flex-col gap-3 md:hidden">
            {(showAll ? rows : rows.slice(0, MOBILE_PAGE)).map((row) => (
              <ResultCard key={row.studentId} row={row} />
            ))}
            {!showAll && rows.length > MOBILE_PAGE && (
              <button type="button" onClick={() => setShowAll(true)} className="min-h-11 text-small text-muted underline-offset-[3px] hover:underline">
                + {rows.length - MOBILE_PAGE} more
              </button>
            )}
          </div>
        </>
      )}
    </>
  )
}

function Tile({ label, value, note, rowStart = false }: { label: string; value: string; note?: string; rowStart?: boolean }) {
  return (
    <div
      className={`flex flex-col gap-0.5 px-[18px] py-3.5 [&:not(:first-child)]:border-s [&:not(:first-child)]:border-rule-soft ${
        rowStart ? 'border-s-0!' : ''
      }`}
    >
      <span className="text-meta text-muted">{label}</span>
      <span className="text-page font-bold">
        <Num>{value}</Num>
      </span>
      {note && <span className="text-meta text-ink-2">{note}</span>}
    </div>
  )
}

const tableColumns = 'grid grid-cols-[minmax(0,2.6fr)_70px_minmax(0,1.3fr)_minmax(0,1.5fr)_minmax(0,1.5fr)_minmax(0,1fr)_80px] gap-4'

function ResultsTable({
  rows,
  maxScore,
  classRoom,
  sort,
  onSort,
}: {
  rows: ResultRow[]
  maxScore: number
  classRoom: string
  sort: SortKey
  onSort: (sort: SortKey) => void
}) {
  return (
    <div role="table" aria-label={classRoom === ALL ? 'Results' : `Results for ${classRoom}`} className="hidden rounded-sheet border border-rule bg-paper md:block">
      <div role="row" className={`${tableColumns} rounded-t-sheet border-b border-rule bg-desk px-5 py-3`}>
        <SortHeader active={sort === 'name'} onClick={() => onSort(sort === 'name' ? 'class' : 'name')}>
          Student
        </SortHeader>
        <Header>Class</Header>
        <Header>Status</Header>
        <Header>Started</Header>
        <Header>Finished</Header>
        <SortHeader end active={sort === 'scoreHigh' || sort === 'scoreLow'} onClick={() => onSort(sort === 'scoreHigh' ? 'scoreLow' : 'scoreHigh')}>
          Score
        </SortHeader>
        <Header end>%</Header>
      </div>
      {rows.map((row, index) => (
        <div key={row.studentId} role="row" className={`${tableColumns} min-h-14 items-center px-5 py-1.5 ${index > 0 ? 'border-t border-rule-soft' : ''}`}>
          <div role="cell" className="flex min-w-0 flex-col">
            <span dir="auto" className="auto-text truncate text-start text-[15px] font-semibold">
              {row.fullName}
            </span>
            <span className="font-mono text-[12px] text-muted">{row.username}</span>
          </div>
          <div role="cell" className="font-mono text-small text-ink-2">
            {row.classRoom}
          </div>
          <div role="cell">
            <Badge kind={row.status} />
          </div>
          <div role="cell" className="text-small text-ink-2">
            {row.startedAt ? formatDateTime(row.startedAt) : '—'}
          </div>
          <div role="cell" className="text-small text-ink-2">
            {row.finalizedAt ? formatDateTime(row.finalizedAt) : '—'}
          </div>
          <div role="cell" className="text-end text-[15px] font-bold">
            {row.score === null ? (
              <span className="text-muted">—</span>
            ) : (
              <Num>
                {formatScore(row.score)} <span className="font-normal text-muted">/ {row.maxScore}</span>
              </Num>
            )}
          </div>
          <div role="cell" className="text-end text-small text-ink-2">
            {row.score === null ? <span className="text-muted">—</span> : <Num>{formatPercent(percentOf(row.score, maxScore) ?? 0)}</Num>}
          </div>
        </div>
      ))}
    </div>
  )
}

function Header({ children, end = false }: { children: ReactNode; end?: boolean }) {
  return (
    <span role="columnheader" className={`text-meta font-semibold text-muted ${end ? 'text-end' : ''}`}>
      {children}
    </span>
  )
}

function SortHeader({ children, active, onClick, end = false }: { children: ReactNode; active: boolean; onClick: () => void; end?: boolean }) {
  return (
    <span role="columnheader" aria-sort={active ? 'other' : undefined} className={end ? 'text-end' : ''}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 text-meta font-semibold ${active ? 'text-ink' : 'text-muted'} hover:text-ink`}
      >
        {children}
        <Icon name="arrowDown" className="size-3.5" />
      </button>
    </span>
  )
}

function ResultCard({ row }: { row: ResultRow }) {
  return (
    <article className="flex flex-col gap-2 rounded-sheet border border-rule bg-paper px-4 py-3.5">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex min-w-0 flex-col">
          <span dir="auto" className="auto-text text-start text-body font-bold">
            {row.fullName}
          </span>
          <span className="font-mono text-[12px] text-muted">
            {row.username} · {row.classRoom}
          </span>
        </div>
        <Badge kind={row.status} />
      </div>
      <div className="flex items-baseline justify-between border-t border-rule-soft pt-2.5">
        {row.score !== null ? (
          <>
            <span className="text-card font-bold">
              <Num>{formatScore(row.score)}</Num> <span className="text-small font-normal text-muted">/ {row.maxScore}</span>
            </span>
            <span className="text-small text-ink-2">
              <Num>{formatPercent(percentOf(row.score, row.maxScore) ?? 0)}</Num>
            </span>
          </>
        ) : (
          <span className="text-small text-muted">
            {row.status === 'Missed'
              ? 'No attempt before the quiz closed'
              : row.status === 'InProgress' && row.startedAt
                ? `Started ${formatDateTime(row.startedAt)} · in progress`
                : 'Not started yet'}
          </span>
        )}
      </div>
    </article>
  )
}
