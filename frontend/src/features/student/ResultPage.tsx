import { useQuery } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useParams } from 'react-router'
import { isApiError } from '../../api/client'
import { getAttemptResult, studentKeys } from '../../api/student'
import type { AttemptResult } from '../../api/types'
import { Num } from '../../components/Auto'
import { Badge } from '../../components/Badge'
import { ButtonLink } from '../../components/Button'
import { Icon, type IconName } from '../../components/Icon'
import { PageShell } from '../../components/PageShell'
import { DoubleRule } from '../../components/Sheet'
import { ErrorState, NotAvailableState, Skeleton } from '../../components/States'
import { formatPercent, formatScore } from '../../lib/format'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatDateTime } from '../../lib/time'
import { scoringExplanation } from './resultCopy'

/** The finished attempt's score (prototype: "Result" and "Result, time ran out"). */
export function ResultPage() {
  const { t } = useLanguage()
  const { attemptId = '' } = useParams()
  const result = useQuery({
    queryKey: studentKeys.result(attemptId),
    queryFn: ({ signal }) => getAttemptResult(attemptId, signal),
  })

  return (
    <PageShell mainClassName="gap-4 pt-4 pb-8">
      {result.isPending ? (
        <div className="flex flex-col gap-4 rounded-sheet border border-rule bg-paper p-[18px]" aria-busy="true" aria-label={t.result.loading}>
          <Skeleton className="h-6 w-[100px] rounded-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="mx-auto h-14 w-40" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : result.isError ? (
        isApiError(result.error, 'not_found') ? (
          <NotAvailableState title={t.result.notAvailableTitle} backTo="/student" backLabel={t.result.back}>
            {t.result.notAvailableBody}
          </NotAvailableState>
        ) : isApiError(result.error, 'attempt.not_finalized') ? (
          <NotAvailableState title={t.result.runningTitle} backTo={`/student/attempts/${attemptId}`} backLabel={t.result.backToQuiz}>
            {t.result.runningBody}
          </NotAvailableState>
        ) : (
          <ErrorState error={result.error} onRetry={() => void result.refetch()} title={t.result.loadError} />
        )
      ) : (
        <ResultSheet result={result.data} />
      )}
    </PageShell>
  )
}

function ResultSheet({ result }: { result: AttemptResult }) {
  const { t, lang } = useLanguage()
  const expired = result.status === 'Expired'
  const negative = result.score < 0

  return (
    <>
      {expired ? (
        <TopNotice icon="hourglass" tone="amber" title={t.result.timeRanOut}>
          {t.result.timeRanOutBody}
        </TopNotice>
      ) : (
        <TopNotice icon="check" tone="green" title={t.result.submitted}>
          {t.result.submittedBody}
        </TopNotice>
      )}

      <section className="flex flex-col gap-4 rounded-sheet border border-rule bg-paper p-[18px]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Badge kind={result.status} />
            <span className="text-meta text-muted">{formatDateTime(result.finalizedAt, lang)}</span>
          </div>
          <h1 dir="auto" className="auto-text text-[20px] leading-[1.45] font-bold">
            {result.quizTitle}
          </h1>
        </div>

        <DoubleRule />

        <div className="flex flex-col items-center gap-1 py-2">
          <span className="text-small text-muted">{t.result.yourScore}</span>
          <div dir="ltr" className="flex items-baseline gap-2 tabular-nums">
            <span className={`text-[52px] leading-[1.1] font-bold ${negative ? 'text-red' : 'text-ink'}`}>{formatScore(result.score)}</span>
            <span className="text-[24px] font-medium text-muted">/ {result.maxScore}</span>
          </div>
          <span className="text-card font-semibold text-ink-2">
            <Num>{formatPercent(result.percentage)}</Num>
          </span>
        </div>

        <div className="flex rounded-option border border-rule">
          <Count icon="check" tone="text-green" value={result.correctCount} label={t.result.correct} />
          <Count icon="x" tone="text-red" value={result.wrongCount} label={t.result.wrong} />
          <Count icon="minusCircle" tone="text-muted" value={result.unansweredCount} label={t.result.unanswered} />
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-body font-bold">{t.result.howScored}</h2>
          <p className="text-small leading-[1.55] text-ink-2">{scoringExplanation(result, t)}</p>
          <dl className="flex flex-col">
            <Row label={t.result.correct}>
              <Num>{result.correctCount}</Num> {t.result.fullPoints}
            </Row>
            <Row label={t.result.wrong}>
              <Num>{result.wrongCount}</Num> {t.result.wrongPenalty(result.wrongAnswerPenaltyPercent)}
            </Row>
            <Row label={t.result.unanswered}>
              <Num>{result.unansweredCount}</Num> {t.result.zeroPoints}
            </Row>
          </dl>
        </div>
      </section>

      {result.review === null && (
        <div className="flex items-start gap-2 text-small leading-[1.45] text-muted">
          <span className="pt-px">
            <Icon name="lock" className="size-4" />
          </span>
          <span>{t.result.reviewHidden}</span>
        </div>
      )}

      <ButtonLink to="/student" size="lg" className="w-full" replace>
        {t.result.back}
      </ButtonLink>
    </>
  )
}

function TopNotice({ icon, tone, title, children }: { icon: IconName; tone: 'green' | 'amber'; title: string; children: ReactNode }) {
  const styles =
    tone === 'green'
      ? { box: 'border-green-line bg-green-bg', ink: 'text-green' }
      : { box: 'border-amber-line bg-amber-bg', ink: 'text-amber-ink' }
  return (
    <div role="status" className={`flex items-start gap-2.5 rounded-option border px-3.5 py-3 ${styles.box}`}>
      <span className={`pt-px ${styles.ink}`}>
        <Icon name={icon} strokeWidth={2} />
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <div className={`text-[15px] leading-[1.4] font-semibold ${styles.ink}`}>{title}</div>
        <div className="text-small leading-normal text-ink-2">{children}</div>
      </div>
    </div>
  )
}

function Count({ icon, tone, value, label }: { icon: IconName; tone: string; value: number; label: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1 px-1 py-3 [&+&]:border-s [&+&]:border-rule-soft">
      <span className={`flex items-center gap-1.5 ${tone}`}>
        <Icon name={icon} className="size-[18px]" strokeWidth={2} />
        <span className="text-[22px] font-bold">
          <Num>{value}</Num>
        </span>
      </span>
      <span className="text-meta text-ink-2">{label}</span>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-rule-soft py-[11px] first:border-t-0">
      <dt className="w-24 flex-none text-small text-muted">{label}</dt>
      <dd className="flex-1 text-[15px] leading-[1.45] text-ink">{children}</dd>
    </div>
  )
}
