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
import { useLanguage } from '../../i18n/LanguageContext'
import { formatDateTime, formatShortDate } from '../../lib/time'
import { localTimeZoneLabel } from './editor/editorForm'
import {
  ALL,
  classFilters,
  filterRows,
  percentOf,
  showingLine,
  SORT_KEYS,
  sortRows,
  statusCounts,
  type ResultRow,
  type SortKey,
} from './results/resultsView'

const MOBILE_PAGE = 10

/** Per-student results with a whole-quiz summary (prototype: "Quiz results", "Quiz results, mobile"). */
export function ResultsPage() {
  const { t } = useLanguage()
  const { quizId = '' } = useParams()
  const results = useQuery({
    queryKey: teacherKeys.results(quizId),
    queryFn: ({ signal }) => getQuizResults(quizId, signal),
  })

  return (
    <PageShell width="teacher" mainClassName="gap-[18px] pt-5 pb-10 md:pt-8 md:pb-12">
      <BackLink to="/teacher" label={t.shell.myQuizzes} />
      {results.isPending ? (
        <div className="flex flex-col gap-4" aria-busy="true" aria-label={t.results.loading}>
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : results.isError ? (
        isApiError(results.error, 'not_found') ? (
          <NotAvailableState title={t.editor.notFoundTitle} backTo="/teacher" backLabel={t.editor.backToMyQuizzes}>
            {t.editor.notFoundBody}
          </NotAvailableState>
        ) : (
          <ErrorState error={results.error} onRetry={() => void results.refetch()} title={t.results.loadError} />
        )
      ) : (
        <Results data={results.data} refreshing={results.isFetching} onRefresh={() => void results.refetch()} />
      )}
    </PageShell>
  )
}

function Results({ data, refreshing, onRefresh }: { data: QuizResults; refreshing: boolean; onRefresh: () => void }) {
  const { t, lang } = useLanguage()
  const m = t.results
  const [classRoom, setClassRoom] = useState<string>(ALL)
  const [sort, setSort] = useState<SortKey>('class')
  const [showAll, setShowAll] = useState(false)
  const { quiz, summary } = data
  const rows = sortRows(filterRows(data.rows, classRoom), sort, lang)
  const counts = statusCounts(data.rows)
  const classes = [...new Set(data.rows.map((r) => r.classRoom))]
  const closed = quiz.state === 'Closed'
  const marking = quiz.wrongAnswerPenaltyPercent === 0 ? m.markingNone : m.markingPer(quiz.wrongAnswerPenaltyPercent)
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
            {m.results} · {closed ? m.closedOn(formatShortDate(quiz.closesAt, lang)) : m.closesOn(formatDateTime(quiz.closesAt, lang))}
            <span className="hidden md:inline"> · {m.minutesShort(quiz.durationMinutes)} · {marking}</span> · {m.maxPoints(quiz.maxScore)}
          </p>
        </div>
        <Button variant="secondary" className="hidden flex-none md:inline-flex" loading={refreshing} onClick={onRefresh}>
          {!refreshing && <Icon name="refresh" className="size-[18px]" />}
          {m.refresh}
        </Button>
      </div>

      {/* Summary covers every assigned class (the API's numbers); the filter below only affects the list. */}
      <div className="hidden grid-cols-6 rounded-sheet border border-rule bg-paper md:grid">
        <Tile label={m.assigned} value={String(summary.assignedCount)} note={classes.join(' · ')} />
        <Tile label={m.started} value={String(summary.startedCount)} note={m.inProgress(counts.inProgress)} />
        <Tile label={m.finalized} value={String(summary.finalizedCount)} note={m.submittedExpired(counts.submitted, counts.expired)} />
        <Tile
          label={m.average}
          value={stat(summary.averageScore)}
          note={summary.averagePercentage === null ? undefined : m.percentOfMax(formatPercent(summary.averagePercentage), quiz.maxScore)}
        />
        <Tile label={m.highest} value={stat(summary.highestScore)} note={statPercent(summary.highestScore)} />
        <Tile label={m.lowest} value={stat(summary.lowestScore)} note={statPercent(summary.lowestScore)} />
      </div>
      <div className="grid grid-cols-3 rounded-sheet border border-rule bg-paper md:hidden">
        <Tile label={m.assigned} value={String(summary.assignedCount)} />
        <Tile label={m.finalized} value={String(summary.finalizedCount)} note={counts.expired > 0 ? m.expired(counts.expired) : undefined} />
        {closed ? (
          <Tile label={m.missed} value={String(counts.missed)} />
        ) : (
          <Tile label={m.started} value={String(summary.startedCount)} note={counts.inProgress > 0 ? m.inProgress(counts.inProgress) : undefined} />
        )}
        <Tile label={m.average} value={stat(summary.averageScore)} note={summary.averagePercentage === null ? undefined : formatPercent(summary.averagePercentage)} rowStart />
        <Tile label={m.highest} value={stat(summary.highestScore)} />
        <Tile label={m.lowest} value={stat(summary.lowestScore)} />
      </div>
      <p className="hidden text-small leading-normal text-muted md:block">
        {m.summaryNote(localTimeZoneLabel(t.editor))}
      </p>

      {data.rows.length === 0 ? (
        <EmptyState icon="users" title={m.noStudentsTitle}>
          {m.noStudentsBody}
        </EmptyState>
      ) : (
        <>
          <div className="flex flex-col gap-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
            <div className="flex flex-col gap-1.5">
              <span className="text-small font-semibold">{m.classLabel}</span>
              <Segmented label={m.filterLabel} options={classFilters(data.rows, m)} value={classRoom} onChange={setClassRoom} className="md:w-[420px]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="results-sort" className="text-small font-semibold">
                {m.sortBy}
              </label>
              <select
                id="results-sort"
                value={sort}
                onChange={(event) => setSort(event.target.value as SortKey)}
                className="h-12 w-full rounded-control border border-strong bg-paper px-3 text-body text-ink md:h-11 md:w-[240px]"
              >
                {SORT_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {m.sort[key]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-small leading-normal text-muted" aria-live="polite">
            {showingLine(rows.length, classRoom, m)}
          </p>

          <ResultsTable rows={rows} maxScore={quiz.maxScore} classRoom={classRoom} sort={sort} onSort={setSort} />

          <div className="flex flex-col gap-3 md:hidden">
            {(showAll ? rows : rows.slice(0, MOBILE_PAGE)).map((row) => (
              <ResultCard key={row.studentId} row={row} />
            ))}
            {!showAll && rows.length > MOBILE_PAGE && (
              <button type="button" onClick={() => setShowAll(true)} className="min-h-11 text-small text-muted underline-offset-[3px] hover:underline">
                {m.more(rows.length - MOBILE_PAGE)}
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
  const { t, lang } = useLanguage()
  const m = t.results
  return (
    <div role="table" aria-label={classRoom === ALL ? m.tableLabel : m.tableLabelFor(classRoom)} className="hidden rounded-sheet border border-rule bg-paper md:block">
      <div role="row" className={`${tableColumns} rounded-t-sheet border-b border-rule bg-desk px-5 py-3`}>
        <SortHeader active={sort === 'name'} onClick={() => onSort(sort === 'name' ? 'class' : 'name')}>
          {m.student}
        </SortHeader>
        <Header>{m.className}</Header>
        <Header>{m.status}</Header>
        <Header>{m.startedCol}</Header>
        <Header>{m.finished}</Header>
        <SortHeader end active={sort === 'scoreHigh' || sort === 'scoreLow'} onClick={() => onSort(sort === 'scoreHigh' ? 'scoreLow' : 'scoreHigh')}>
          {m.score}
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
            {row.startedAt ? formatDateTime(row.startedAt, lang) : '—'}
          </div>
          <div role="cell" className="text-small text-ink-2">
            {row.finalizedAt ? formatDateTime(row.finalizedAt, lang) : '—'}
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
  const { t, lang } = useLanguage()
  const m = t.results
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
              ? m.noAttempt
              : row.status === 'InProgress' && row.startedAt
                ? m.startedInProgress(formatDateTime(row.startedAt, lang))
                : m.notStarted}
          </span>
        )}
      </div>
    </article>
  )
}
