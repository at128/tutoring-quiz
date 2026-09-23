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
import { formatDateTime } from '../../lib/time'

/** The finished attempt's score (prototype: "Result" and "Result, time ran out"). */
export function ResultPage() {
  const { attemptId = '' } = useParams()
  const result = useQuery({
    queryKey: studentKeys.result(attemptId),
    queryFn: ({ signal }) => getAttemptResult(attemptId, signal),
  })

  return (
    <PageShell mainClassName="gap-4 pt-4 pb-8">
      {result.isPending ? (
        <div className="flex flex-col gap-4 rounded-sheet border border-rule bg-paper p-[18px]" aria-busy="true" aria-label="Loading your result">
          <Skeleton className="h-6 w-[100px] rounded-full" />
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="mx-auto h-14 w-40" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : result.isError ? (
        isApiError(result.error, 'not_found') ? (
          <NotAvailableState title="This result isn’t available" backTo="/student" backLabel="Back to your quizzes">
            It may belong to another account. Check your list of quizzes.
          </NotAvailableState>
        ) : isApiError(result.error, 'attempt.not_finalized') ? (
          <NotAvailableState title="This quiz is still running" backTo={`/student/attempts/${attemptId}`} backLabel="Back to the quiz">
            Your result appears here once you submit or the time runs out.
          </NotAvailableState>
        ) : (
          <ErrorState error={result.error} onRetry={() => void result.refetch()} title="Couldn’t load your result" />
        )
      ) : (
        <ResultSheet result={result.data} />
      )}
    </PageShell>
  )
}

function ResultSheet({ result }: { result: AttemptResult }) {
  const expired = result.status === 'Expired'
  const negative = result.score < 0

  return (
    <>
      {expired ? (
        <TopNotice icon="hourglass" tone="amber" title="Time ran out">
          Your saved answers were submitted automatically. Answers chosen after the deadline don’t count.
        </TopNotice>
      ) : (
        <TopNotice icon="check" tone="green" title="Quiz submitted">
          Your answers are final.
        </TopNotice>
      )}

      <section className="flex flex-col gap-4 rounded-sheet border border-rule bg-paper p-[18px]">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Badge kind={result.status} />
            <span className="text-meta text-muted">{formatDateTime(result.finalizedAt)}</span>
          </div>
          <h1 dir="auto" className="auto-text text-[20px] leading-[1.45] font-bold">
            {result.quizTitle}
          </h1>
        </div>

        <DoubleRule />

        <div className="flex flex-col items-center gap-1 py-2">
          <span className="text-small text-muted">Your score</span>
          <div dir="ltr" className="flex items-baseline gap-2 tabular-nums">
            <span className={`text-[52px] leading-[1.1] font-bold ${negative ? 'text-red' : 'text-ink'}`}>{formatScore(result.score)}</span>
            <span className="text-[24px] font-medium text-muted">/ {result.maxScore}</span>
          </div>
          <span className="text-card font-semibold text-ink-2">
            <Num>{formatPercent(result.percentage)}</Num>
          </span>
        </div>

        <div className="flex rounded-option border border-rule">
          <Count icon="check" tone="text-green" value={result.correctCount} label="Correct" />
          <Count icon="x" tone="text-red" value={result.wrongCount} label="Wrong" />
          <Count icon="minusCircle" tone="text-muted" value={result.unansweredCount} label="Unanswered" />
        </div>

        <div className="flex flex-col gap-1.5">
          <h2 className="text-body font-bold">How this was scored</h2>
          <p className="text-small leading-[1.55] text-ink-2">{scoringExplanation(result)}</p>
          <dl className="flex flex-col">
            <Row label="Correct">
              <Num>{result.correctCount}</Num> × full points
            </Row>
            <Row label="Wrong">
              <Num>{result.wrongCount}</Num> ×{' '}
              {result.wrongAnswerPenaltyPercent > 0 ? `−${result.wrongAnswerPenaltyPercent}% of the question’s points` : '0 points'}
            </Row>
            <Row label="Unanswered">
              <Num>{result.unansweredCount}</Num> × 0 points
            </Row>
          </dl>
        </div>
      </section>

      {result.review === null && (
        <div className="flex items-start gap-2 text-small leading-[1.45] text-muted">
          <span className="pt-px">
            <Icon name="lock" className="size-4" />
          </span>
          <span>Correct answers aren’t shown while the quiz is open, so they can’t reach classmates who haven’t taken it yet.</span>
        </div>
      )}

      <ButtonLink to="/student" size="lg" className="w-full" replace>
        Back to your quizzes
      </ButtonLink>
    </>
  )
}

/** Plain words for how negative marking affected this score (the server already applied it). */
function scoringExplanation(result: AttemptResult): string {
  const k = result.wrongAnswerPenaltyPercent
  if (k === 0) return 'This quiz has no negative marking: wrong and unanswered questions scored zero.'
  const rule = `This quiz uses negative marking: each wrong answer lost ${k}% of its points.`
  if (result.score < 0) return `${rule} Your total is below zero because the deductions were larger than the points you earned.`
  if (result.wrongCount === 0) return `${rule} You had no wrong answers, so nothing was deducted.`
  const wrong = result.wrongCount === 1 ? 'Your 1 wrong answer' : `Your ${result.wrongCount} wrong answers`
  return `${rule} ${wrong} lowered your score; unanswered questions didn’t.`
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
