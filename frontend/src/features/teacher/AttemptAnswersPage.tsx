import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { isApiError } from '../../api/client'
import { getTeacherAttempt, teacherKeys } from '../../api/teacher'
import type { AnswerOutcome, TeacherAttemptDetail } from '../../api/types'
import { Num } from '../../components/Auto'
import { Badge } from '../../components/Badge'
import { Icon, type IconName } from '../../components/Icon'
import { BackLink, PageShell } from '../../components/PageShell'
import { DoubleRule } from '../../components/Sheet'
import { ErrorState, NotAvailableState, Skeleton } from '../../components/States'
import { useLanguage } from '../../i18n/LanguageContext'
import { optionLabel } from '../../lib/dir'
import { formatPercent, formatScore } from '../../lib/format'
import { markingOf } from '../../lib/marking'
import { formatDateTime } from '../../lib/time'
import { markingText } from './teacherMarking'

/** One student's answers, question by question, scored by the quiz as it is now (the teacher's view). */
export function AttemptAnswersPage() {
  const { t } = useLanguage()
  const m = t.answers
  const { quizId = '', attemptId = '' } = useParams()
  const resultsPath = `/teacher/quizzes/${quizId}/results`
  const detail = useQuery({
    queryKey: teacherKeys.attempt(quizId, attemptId),
    queryFn: ({ signal }) => getTeacherAttempt(quizId, attemptId, signal),
  })

  return (
    <PageShell width="teacher" mainClassName="gap-5 pt-5 pb-10 md:pt-8 md:pb-12">
      <BackLink to={resultsPath} label={m.backToResults} />
      {detail.isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true" aria-label={m.loading}>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : detail.isError ? (
        isApiError(detail.error, 'not_found') ? (
          <NotAvailableState title={m.notFoundTitle} backTo={resultsPath} backLabel={m.backToResults}>
            {m.notFoundBody}
          </NotAvailableState>
        ) : (
          <ErrorState error={detail.error} onRetry={() => void detail.refetch()} title={m.loadError} />
        )
      ) : (
        <AttemptSheet detail={detail.data} />
      )}
    </PageShell>
  )
}

function AttemptSheet({ detail }: { detail: TeacherAttemptDetail }) {
  const { t, lang } = useLanguage()
  const m = t.answers
  const finished = detail.status !== 'InProgress'
  const floored = finished && detail.questionsTotal < 0

  return (
    <>
      <section className="flex flex-col gap-3 rounded-sheet border border-rule bg-paper p-[18px] md:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge kind={detail.status} />
          <span dir="auto" className="auto-text min-w-0 text-small text-muted">
            {detail.quizTitle}
          </span>
        </div>
        <h1 dir="auto" className="auto-text w-fit max-w-full text-page leading-[1.3] font-bold">
          {detail.student.fullName}
        </h1>
        <p className="font-mono text-small text-muted">
          {detail.student.username}
          {detail.student.classRoom && ` · ${detail.student.classRoom}`}
        </p>
        <DoubleRule />
        <dl className="flex flex-col">
          <Fact label={m.score}>
            {detail.score === null ? (
              <span className="text-muted">{m.notFinished}</span>
            ) : (
              <strong className="text-ink">
                <Num>
                  {formatScore(detail.score)} / {detail.maxScore}
                </Num>
                {detail.percentage !== null && (
                  <span className="font-normal text-muted">
                    {' · '}
                    <Num>{formatPercent(detail.percentage)}</Num>
                  </span>
                )}
              </strong>
            )}
          </Fact>
          <Fact label={m.counts}>{m.countsLine(detail.correctCount, detail.wrongCount, detail.unansweredCount)}</Fact>
          <Fact label={m.started}>{formatDateTime(detail.startedAt, lang)}</Fact>
          <Fact label={m.finished}>{detail.finalizedAt ? formatDateTime(detail.finalizedAt, lang) : '—'}</Fact>
          <Fact label={m.marking}>{markingText(markingOf(detail), t)}</Fact>
          <Fact label={m.studentsSee}>{detail.scoresVisibleToStudents ? m.scoreVisible : m.scoreHidden}</Fact>
        </dl>
        {detail.regradedAt && <p className="text-small text-ink-2">{m.regraded(formatDateTime(detail.regradedAt, lang))}</p>}
        {floored && <p className="text-small text-ink-2">{m.floored(formatScore(detail.questionsTotal))}</p>}
      </section>

      <h2 className="text-card font-bold">{m.answersTitle}</h2>
      <ol className="flex flex-col gap-4">
        {detail.questions.map((question, index) => (
          <QuestionSheet key={question.questionId} number={index + 1} question={question} />
        ))}
      </ol>
    </>
  )
}

const OUTCOME_STYLE: Record<AnswerOutcome, { icon: IconName; className: string }> = {
  Correct: { icon: 'check', className: 'text-green' },
  Wrong: { icon: 'x', className: 'text-red' },
  Unanswered: { icon: 'minusCircle', className: 'text-muted' },
}

function QuestionSheet({ number, question }: { number: number; question: TeacherAttemptDetail['questions'][number] }) {
  const { t } = useLanguage()
  const m = t.answers
  const outcome = OUTCOME_STYLE[question.outcome]
  const outcomeLabel = { Correct: m.correct, Wrong: m.wrong, Unanswered: m.unanswered }[question.outcome]

  return (
    <li className="flex flex-col gap-3 rounded-sheet border border-rule bg-paper p-[18px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-small font-semibold text-muted">{m.questionN(number)}</span>
        <span className="flex items-center gap-3">
          <span className="rounded-full border border-rule px-2.5 py-0.5 text-meta text-ink-2">{m.points(question.points)}</span>
          <span className={`inline-flex items-center gap-1 text-small font-semibold ${outcome.className}`}>
            <Icon name={outcome.icon} className="size-4" />
            {outcomeLabel}
          </span>
        </span>
      </div>
      <p dir="auto" className="auto-text text-body leading-[1.6] font-semibold whitespace-pre-wrap">
        {question.text}
      </p>
      <ul className="flex flex-col gap-2">
        {question.options.map((option, i) => {
          const chosen = option.id === question.selectedOptionId
          const border = chosen ? (option.isCorrect ? 'border-green bg-green-bg' : 'border-red bg-red-bg') : option.isCorrect ? 'border-green-line' : 'border-rule'
          return (
            <li key={option.id} className={`flex min-h-11 items-center gap-3 rounded-option border px-3 py-2 ${border}`}>
              <span className="flex size-7 flex-none items-center justify-center rounded-full border border-rule text-small font-semibold">
                {optionLabel(i, question.text)}
              </span>
              <span dir="auto" className="auto-text min-w-0 flex-1 text-[15px]">
                {option.text}
              </span>
              <span className="flex flex-none flex-col items-end gap-0.5 text-meta font-semibold">
                {chosen && <span className={option.isCorrect ? 'text-green' : 'text-red'}>{m.studentAnswer}</span>}
                {option.isCorrect && (
                  <span className="inline-flex items-center gap-1 text-green">
                    <Icon name="check" className="size-3.5" />
                    {m.correctAnswer}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
      {question.removedSelectionText !== null ? (
        <p className="text-small text-ink-2">
          {m.removedChoice} <span dir="auto">«{question.removedSelectionText}»</span>
        </p>
      ) : (
        question.selectedOptionId === null && <p className="text-small text-muted">{m.noChoice}</p>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-rule-soft pt-2.5 text-small">
        <span className="text-ink-2">
          {question.outcome === 'Correct'
            ? m.earned(formatScore(question.earned))
            : question.outcome === 'Wrong'
              ? m.deducted(formatScore(question.deduction))
              : m.nothing}
        </span>
        <span className="font-bold">
          <Num>{formatScore(question.contribution)}</Num>
        </span>
      </div>
    </li>
  )
}

/** Label, then its value right after it (on the right in Arabic), rather than pushed to the far edge. */
function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-baseline gap-4 border-t border-rule-soft py-2 first:border-t-0 md:grid-cols-[10rem_minmax(0,1fr)]">
      <dt className="text-small text-muted">{label}</dt>
      <dd className="text-start text-[15px]">{children}</dd>
    </div>
  )
}
