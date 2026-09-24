import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { listTeacherQuizzes, teacherKeys } from '../../api/teacher'
import type { TeacherQuizSummary } from '../../api/types'
import { Badge } from '../../components/Badge'
import { ButtonLink } from '../../components/Button'
import { ClassChip } from '../../components/ClassChip'
import { Icon } from '../../components/Icon'
import { PageShell } from '../../components/PageShell'
import { ErrorState, Skeleton } from '../../components/States'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatDateTime } from '../../lib/time'
import { useServerNow } from '../../lib/useServerNow'
import { hasResults, progressOf } from './teacherCopy'
import { teacherListRefreshDelay } from './teacherListRefresh'

const editPath = (id: string) => `/teacher/quizzes/${id}/edit`
const resultsPath = (id: string) => `/teacher/quizzes/${id}/results`

/** The teacher's own quizzes, ordered Open, Scheduled, Draft, Closed (prototype: "My quizzes, teacher"). */
export function TeacherQuizListPage() {
  const { t } = useLanguage()
  const quizzes = useQuery({
    queryKey: teacherKeys.quizzes(),
    queryFn: ({ signal }) => listTeacherQuizzes(signal),
    refetchInterval: (query) => teacherListRefreshDelay(query.state.data, Date.now()),
  })
  const nowMs = useServerNow(0)

  return (
    <PageShell width="teacher" mainClassName="gap-6 pt-5 pb-10 md:pt-8 md:pb-12">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-page leading-[1.3] font-bold md:text-display">{t.shell.myQuizzes}</h1>
          {quizzes.data && (
            <p className="text-small text-muted">
              {t.teacher.quizCount(quizzes.data.length)}
              <span className="hidden md:inline"> · {t.teacher.sortedNote}</span>
            </p>
          )}
        </div>
        <ButtonLink to="/teacher/quizzes/new" size="lg" className="w-full md:w-auto">
          <Icon name="plus" className="size-[18px]" />
          {t.teacher.newQuiz}
        </ButtonLink>
      </div>

      {quizzes.isPending ? (
        <ListSkeleton />
      ) : quizzes.isError ? (
        <ErrorState error={quizzes.error} onRetry={() => void quizzes.refetch()} title={t.teacher.listError} />
      ) : quizzes.data.length === 0 ? (
        <NoQuizzes />
      ) : (
        <>
          <QuizTable quizzes={quizzes.data} nowMs={nowMs} />
          <div className="flex flex-col gap-3 md:hidden">
            {quizzes.data.map((quiz) => (
              <QuizCardTeacher key={quiz.id} quiz={quiz} nowMs={nowMs} />
            ))}
          </div>
          {quizzes.data.some((q) => q.isLocked) && (
            <p className="flex items-start gap-2 text-small leading-normal text-muted">
              <span className="pt-0.5">
                <Icon name="lock" className="size-4" />
              </span>
              {t.teacher.lockNote}
            </p>
          )}
        </>
      )}
    </PageShell>
  )
}

function StateBadges({ quiz }: { quiz: TeacherQuizSummary }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <Badge kind={quiz.state} />
      {quiz.isLocked && <Badge kind="Locked" />}
    </div>
  )
}

function ClassesAndSize({ quiz, long = false }: { quiz: TeacherQuizSummary; long?: boolean }) {
  const { t } = useLanguage()
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {quiz.classRooms.map((c) => (
        <ClassChip key={c.id} name={c.name} />
      ))}
      <span className="text-meta text-muted">
        {t.teacher.questionsAndPoints(quiz.questionCount, quiz.maxScore)}
        {long && ` · ${t.teacher.minutesShort(quiz.durationMinutes)} · ${t.teacher.markingInline(quiz.wrongAnswerPenaltyPercent)}`}
      </span>
    </div>
  )
}

function Actions({ quiz, stretch = false }: { quiz: TeacherQuizSummary; stretch?: boolean }) {
  const { t } = useLanguage()
  const wrap = (node: ReactNode) => (stretch ? <div className="flex-1">{node}</div> : node)
  const size = stretch ? 'w-full' : ''
  return (
    <>
      {hasResults(quiz.state) &&
        wrap(
          <ButtonLink to={resultsPath(quiz.id)} variant="secondary" className={size}>
            {t.teacher.results}
          </ButtonLink>,
        )}
      {wrap(
        <ButtonLink to={editPath(quiz.id)} variant={stretch ? 'secondary' : 'ghost'} className={size}>
          <Icon name={quiz.isLocked ? 'eye' : 'pencil'} className="size-[18px]" />
          {quiz.isLocked ? t.teacher.view : t.teacher.edit}
        </ButtonLink>,
      )}
    </>
  )
}

const columns = 'grid grid-cols-[minmax(0,3.2fr)_minmax(0,1.5fr)_minmax(0,1.7fr)_minmax(0,1.2fr)_minmax(0,1.3fr)_220px] gap-5'

/** ≥ md: a ruled table. */
function QuizTable({ quizzes, nowMs }: { quizzes: TeacherQuizSummary[]; nowMs: number }) {
  const { t, lang } = useLanguage()
  const c = t.teacher.columns
  return (
    <div role="table" aria-label={t.shell.myQuizzes} className="hidden rounded-sheet border border-rule bg-paper md:block">
      <div role="row" className={`${columns} rounded-t-sheet border-b border-rule bg-desk px-5 py-3`}>
        {[c.quiz, c.state, c.window, c.timeMarking, c.progress].map((h) => (
          <span key={h} role="columnheader" className="text-meta font-semibold text-muted">
            {h}
          </span>
        ))}
        <span role="columnheader" className="text-end text-meta font-semibold text-muted">
          {c.actions}
        </span>
      </div>
      {quizzes.map((quiz, index) => {
        const progress = progressOf(quiz, nowMs, t, lang)
        return (
          <div key={quiz.id} role="row" className={`${columns} items-center px-5 py-4 ${index > 0 ? 'border-t border-rule-soft' : ''}`}>
            <div role="cell" className="flex min-w-0 flex-col gap-1.5">
              <Link to={editPath(quiz.id)} dir="auto" className="auto-text text-body leading-[1.45] font-bold text-ink hover:underline">
                {quiz.title}
              </Link>
              <ClassesAndSize quiz={quiz} />
            </div>
            <div role="cell">
              <StateBadges quiz={quiz} />
            </div>
            <div role="cell" className="text-small leading-[1.55] text-ink-2">
              <div>{t.teacher.opensOn(formatDateTime(quiz.opensAt, lang))}</div>
              <div>{t.teacher.closesOn(formatDateTime(quiz.closesAt, lang))}</div>
            </div>
            <div role="cell" className="text-small leading-[1.55] text-ink-2">
              <div>{t.teacher.minutesShort(quiz.durationMinutes)}</div>
              <div>{t.teacher.markingShort(quiz.wrongAnswerPenaltyPercent)}</div>
            </div>
            <div role="cell" className="flex flex-col gap-0.5">
              <span className="text-body font-bold">{progress.value ?? '—'}</span>
              <span className="text-meta text-muted">{progress.caption}</span>
            </div>
            <div role="cell" className="flex justify-end gap-2">
              <Actions quiz={quiz} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

/** < md: stacked cards. */
function QuizCardTeacher({ quiz, nowMs }: { quiz: TeacherQuizSummary; nowMs: number }) {
  const { t, lang } = useLanguage()
  const progress = progressOf(quiz, nowMs, t, lang)
  return (
    <article className="flex flex-col gap-3 rounded-sheet border border-rule bg-paper p-4">
      <StateBadges quiz={quiz} />
      <h3 dir="auto" className="auto-text text-card leading-[1.45] font-bold">
        <Link to={editPath(quiz.id)}>{quiz.title}</Link>
      </h3>
      <ClassesAndSize quiz={quiz} long />
      <dl className="flex flex-col">
        <Row label={t.teacher.opens}>{formatDateTime(quiz.opensAt, lang)}</Row>
        <Row label={t.teacher.closes}>{formatDateTime(quiz.closesAt, lang)}</Row>
        <Row label={t.teacher.progress}>
          {progress.value ? (
            <>
              <strong>{progress.value}</strong> {progress.caption}
            </>
          ) : (
            <>
              <strong>—</strong> {progress.caption}
            </>
          )}
        </Row>
      </dl>
      <div className="flex gap-2.5">
        <Actions quiz={quiz} stretch />
      </div>
    </article>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-rule-soft py-[11px] first:border-t-0">
      <dt className="w-20 flex-none text-small text-muted">{label}</dt>
      <dd className="flex-1 text-[15px] leading-[1.45] text-ink">{children}</dd>
    </div>
  )
}

function NoQuizzes() {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col items-center gap-3 rounded-sheet border border-dashed border-strong bg-paper px-5 py-8 text-center">
      <span className="flex size-[52px] items-center justify-center rounded-full bg-desk text-ink">
        <Icon name="book" className="size-[26px]" />
      </span>
      <h2 className="text-card font-bold">{t.teacher.emptyTitle}</h2>
      <p className="max-w-[300px] text-[15px] leading-[1.55] text-ink-2">{t.teacher.emptyBody}</p>
      <ButtonLink to="/teacher/quizzes/new">
        <Icon name="plus" className="size-[18px]" />
        {t.teacher.newQuiz}
      </ButtonLink>
    </div>
  )
}

function ListSkeleton() {
  const { t } = useLanguage()
  return (
    <div className="flex flex-col gap-3 rounded-sheet border border-rule bg-paper p-4" aria-busy="true" aria-label={t.teacher.loadingList}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex flex-col gap-2 border-t border-rule-soft pt-3 first:border-t-0 first:pt-0">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  )
}
