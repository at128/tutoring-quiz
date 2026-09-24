import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router'
import { isApiError } from '../../api/client'
import { listStudentQuizzes, startAttempt, studentKeys } from '../../api/student'
import type { StudentQuizCard } from '../../api/types'
import { useSignedInUser } from '../../auth/useAuth'
import { Num } from '../../components/Auto'
import { Badge } from '../../components/Badge'
import { Banner } from '../../components/Banner'
import { Button, ButtonLink } from '../../components/Button'
import { Icon, type IconName } from '../../components/Icon'
import { PageShell } from '../../components/PageShell'
import { DoubleRule } from '../../components/Sheet'
import { ErrorState, NotAvailableState, Skeleton } from '../../components/States'
import { formatPercent, formatScore } from '../../lib/format'
import { formatDayTime, formatRelative, formatShortDate, formatTime, remainingMs, serverOffset } from '../../lib/time'
import { useServerNow } from '../../lib/useServerNow'
import { useLanguage } from '../../i18n/LanguageContext'
import { liveQuiz } from './liveQuiz'
import { Timer } from './takeQuiz/QuizHeader'
import { displayPercentage, isShortOnTime } from './studentQuizCopy'


/** Quiz details before starting (prototype: "Start quiz" and "Start quiz states"). */
export function StartQuizPage() {
  const { t } = useLanguage()
  const BACK = { to: '/student', label: t.student.yourQuizzes }
  const { quizId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const list = useQuery({ queryKey: studentKeys.quizzes(), queryFn: ({ signal }) => listStudentQuizzes(signal) })
  const sourceQuiz = list.data?.quizzes.find((item) => item.id === quizId)
  const offset = list.data ? serverOffset(list.data.serverNow, list.dataUpdatedAt) : 0
  const nowMs = useServerNow(offset, 1000)
  const quiz = sourceQuiz ? liveQuiz(sourceQuiz, nowMs) : null

  const start = useMutation({
    mutationFn: () => startAttempt(quizId),
    onSuccess: (attempt) => {
      void queryClient.invalidateQueries({ queryKey: studentKeys.quizzes() })
      navigate(`/student/attempts/${attempt.id}`, { replace: true })
    },
    // not open yet / closed / already taken: refresh so the page shows the real state.
    onError: () => void queryClient.invalidateQueries({ queryKey: studentKeys.quizzes() }),
  })

  if (list.isPending)
    return (
      <PageShell back={BACK}>
        <div className="flex flex-col gap-4 rounded-sheet border border-rule bg-paper p-[18px]" aria-busy="true" aria-label={t.start.loading}>
          <Skeleton className="h-6 w-[90px] rounded-full" />
          <Skeleton className="h-7 w-4/5" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-48 w-full" />
        </div>
      </PageShell>
    )

  if (list.isError)
    return (
      <PageShell back={BACK}>
        <ErrorState error={list.error} onRetry={() => void list.refetch()} title={t.start.loadError} />
      </PageShell>
    )

  if (!quiz)
    return (
      <PageShell back={BACK}>
        <NotAvailableState title={t.start.notAvailableTitle} backTo="/student" backLabel={t.start.backToQuizzes}>
          {t.start.notAvailableBody}
        </NotAvailableState>
      </PageShell>
    )

  const startError = start.error && !isApiError(start.error, 'quiz.not_open_yet', 'quiz.closed', 'attempt.already_taken')

  return (
    <PageShell
      back={BACK}
      mainClassName="gap-4 pt-4 pb-6"
      footer={<FooterAction quiz={quiz} nowMs={nowMs} starting={start.isPending} onStart={() => start.mutate()} />}
    >
      {startError && (
        <Banner kind="error" title={t.start.startFailed}>
          {isApiError(start.error, 'network_error') ? t.errors.checkConnection : t.errors.tryLater}
        </Banner>
      )}
      <StateBox quiz={quiz} nowMs={nowMs} offsetMs={offset} />
      <DetailsSheet quiz={quiz} nowMs={nowMs} />
      <BeforeYouStart />
    </PageShell>
  )
}

function StateBox({ quiz, nowMs, offsetMs }: { quiz: StudentQuizCard; nowMs: number; offsetMs: number }) {
  const { t, lang } = useLanguage()
  switch (quiz.status) {
    case 'Available': {
      if (isShortOnTime(quiz))
        return (
          <div role="alert" className="flex flex-col gap-2 rounded-option border-2 border-amber bg-amber-bg p-3.5">
            <div className="flex items-center gap-2.5 text-amber-ink">
              <Icon name="alert" strokeWidth={2} />
              <span className="text-card font-bold">
                {t.start.shortTitle(t.student.onlyMinutes(quiz.effectiveMinutesIfStartedNow ?? 0))}
              </span>
            </div>
            <p className="text-[15px] leading-[1.55] text-ink">{t.start.shortBody(formatTime(quiz.closesAt), quiz.durationMinutes)}</p>
          </div>
        )
      const until = new Date(nowMs + quiz.durationMinutes * 60_000).toISOString()
      return (
        <div className="flex items-center gap-3 rounded-option border border-rule bg-tint px-3.5 py-3">
          <Icon name="clock" className="size-[22px]" strokeWidth={2} />
          <div className="flex flex-col gap-0.5">
            <span className="text-meta text-muted">{t.start.ifStartNow}</span>
            <span className="text-body font-semibold">{t.start.fullTime(quiz.durationMinutes, formatTime(until))}</span>
          </div>
        </div>
      )
    }

    case 'InProgress':
      if (!quiz.attempt) return null
      return (
        <div className="flex flex-col gap-2.5 rounded-option border-2 border-ink bg-tint p-3.5">
          <div className="flex items-center gap-2.5">
            <Icon name="halfCircle" />
            <span className="text-[17px] font-bold">{t.start.alreadyStarted}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <Timer remainingMs={remainingMs(quiz.attempt.deadline, offsetMs)} />
            <span className="text-small text-ink-2">{t.student.leftEndsAt(formatTime(quiz.attempt.deadline))}</span>
          </div>
          <p className="text-small leading-normal text-ink-2">{t.start.savedWaiting}</p>
        </div>
      )

    case 'Upcoming':
      return (
        <InfoBox icon="calendar" title={t.start.opensAt(formatShortDate(quiz.opensAt, lang), formatTime(quiz.opensAt))}>
          {t.start.comeBack(quiz.durationMinutes)}
        </InfoBox>
      )

    case 'Completed': {
      const attempt = quiz.attempt
      if (!attempt) return null
      const score = attempt.score ?? 0
      return (
        <div className="flex flex-col gap-2 rounded-option border-2 border-ink bg-paper p-3.5">
          <div className="flex items-center gap-2.5">
            <Icon name="check" strokeWidth={2} />
            <span className="text-[17px] font-bold">{t.start.alreadyTaken}</span>
          </div>
          {attempt.scoreVisible ? (
            <p className="text-[15px] text-ink-2">
              {t.start.yourScoreColon}{' '}
              <strong className="text-ink">
                <Num>
                  {formatScore(score)} / {attempt.maxScore}
                </Num>
              </strong>{' '}
              · <Num>{formatPercent(displayPercentage(score, attempt.maxScore))}</Num>
            </p>
          ) : (
            <p className="text-[15px] text-ink-2">{t.start.scoreHidden}</p>
          )}
          <p className="text-meta text-muted">{t.start.onceOnly}</p>
        </div>
      )
    }

    case 'Missed':
      return (
        <InfoBox icon="minusCircle" title={t.start.closedAt(formatShortDate(quiz.closesAt, lang), formatTime(quiz.closesAt))}>
          {t.start.missedBody}
        </InfoBox>
      )
  }
}

function InfoBox({ icon, title, children }: { icon: IconName; title: string; children: ReactNode }) {
  return (
    <div role="status" className="flex items-start gap-2.5 rounded-option border border-rule bg-tint px-3.5 py-3">
      <span className="pt-px text-ink">
        <Icon name={icon} />
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="text-[15px] leading-[1.4] font-semibold">{title}</div>
        <div className="text-small leading-normal text-ink-2">{children}</div>
      </div>
    </div>
  )
}

function DetailsSheet({ quiz, nowMs }: { quiz: StudentQuizCard; nowMs: number }) {
  const { t, lang } = useLanguage()
  const user = useSignedInUser()
  const example = (2 * quiz.wrongAnswerPenaltyPercent) / 100
  const fixedPoints = quiz.wrongAnswerPenaltyPoints

  return (
    <section className="flex flex-col gap-4 rounded-sheet border border-rule bg-paper p-[18px]">
      <div className="flex flex-col gap-2.5">
        <Badge kind={quiz.status} />
        <h1 dir="auto" className="auto-text w-fit max-w-full text-[24px] leading-[1.45] font-bold">
          {quiz.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-small text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <Icon name="users" className="size-4" />
            <span dir="auto">{quiz.teacherName}</span>
          </span>
          {user.classRoom && (
            <>
              <span className="text-rule">|</span>
              <span>{t.shell.className(user.classRoom.name)}</span>
            </>
          )}
        </div>
        {quiz.description && (
          <p dir="auto" className="auto-text text-[15px] leading-[1.7] whitespace-pre-wrap text-ink-2">
            {quiz.description}
          </p>
        )}
      </div>

      <DoubleRule />

      <dl className="flex flex-col">
        <Fact label={t.start.questions}>
          <Num>{quiz.questionCount}</Num>
        </Fact>
        <Fact label={t.start.maxScore}>{t.start.points(quiz.maxScore)}</Fact>
        <Fact label={t.start.timeLimit}>{t.start.minutes(quiz.durationMinutes)}</Fact>
        <Fact label={t.start.opens}>{formatDayTime(quiz.opensAt, nowMs, lang)}</Fact>
        <Fact label={t.start.closes}>{formatDayTime(quiz.closesAt, nowMs, lang)}</Fact>
        <Fact label={t.start.negativeMarking}>
          {fixedPoints != null ? (
            <>
              <strong className="font-semibold">{t.start.penaltyYesPoints(fixedPoints)}</strong> {t.start.penaltyDetailPoints}
            </>
          ) : quiz.wrongAnswerPenaltyPercent > 0 ? (
            <>
              <strong className="font-semibold">{t.start.penaltyYes(quiz.wrongAnswerPenaltyPercent)}</strong>{' '}
              {t.start.penaltyDetail(quiz.wrongAnswerPenaltyPercent, formatScore(-example))}
            </>
          ) : (
            <>
              <strong className="font-semibold">{t.start.penaltyNo}</strong> {t.start.penaltyNoDetail}
            </>
          )}
        </Fact>
      </dl>
    </section>
  )
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-rule-soft py-[11px] first:border-t-0">
      <dt className="w-[118px] flex-none text-small text-muted">{label}</dt>
      <dd className="flex-1 text-[15px] leading-[1.45] text-ink">{children}</dd>
    </div>
  )
}

function BeforeYouStart() {
  const { t } = useLanguage()
  const rules: { icon: IconName; text: string }[] = [
    { icon: 'lock', text: t.start.rules.once },
    { icon: 'check', text: t.start.rules.saves },
    { icon: 'clock', text: t.start.rules.timer },
    { icon: 'arrowRight', text: t.start.rules.auto },
  ]
  return (
    <div className="flex flex-col gap-2.5">
      <h2 className="text-body font-bold">{t.start.beforeYouStart}</h2>
      <ul className="flex flex-col gap-2.5">
        {rules.map((rule) => (
          <li key={rule.text} className="flex items-start gap-2.5 text-small leading-normal text-ink-2">
            <span className="pt-0.5">
              <Icon name={rule.icon} className="size-4" />
            </span>
            <span>{rule.text}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FooterAction({ quiz, nowMs, starting, onStart }: { quiz: StudentQuizCard; nowMs: number; starting: boolean; onStart: () => void }) {
  const { t, lang } = useLanguage()
  switch (quiz.status) {
    case 'Available':
      return (
        <Button size="lg" className="w-full" loading={starting} onClick={onStart}>
          {isShortOnTime(quiz) ? t.start.startShort(t.student.minutes(quiz.effectiveMinutesIfStartedNow ?? 0)) : t.start.start}
        </Button>
      )
    case 'InProgress':
      return quiz.attempt ? (
        <ButtonLink to={`/student/attempts/${quiz.attempt.id}`} size="lg" className="w-full">
          {t.student.resume}
          <Icon name="chevronRight" className="size-[18px]" />
        </ButtonLink>
      ) : null
    case 'Completed':
      return quiz.attempt ? (
        <ButtonLink to={`/student/attempts/${quiz.attempt.id}/result`} variant="secondary" size="lg" className="w-full">
          {t.student.viewResult}
        </ButtonLink>
      ) : null
    case 'Upcoming':
      return <DisabledAction>{t.start.opensRelative(formatRelative(quiz.opensAt, nowMs, lang))}</DisabledAction>
    case 'Missed':
      return <DisabledAction>{t.start.closed}</DisabledAction>
  }
}

function DisabledAction({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      disabled
      className="flex min-h-12 w-full items-center justify-center rounded-control border border-rule-soft bg-rule-soft px-[18px] text-body leading-[1.2] font-semibold text-[#6B7690]"
    >
      {children}
    </button>
  )
}
