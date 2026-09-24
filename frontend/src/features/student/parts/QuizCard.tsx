import type { ReactNode } from 'react'
import type { StudentQuizCard } from '../../../api/types'
import { Num } from '../../../components/Auto'
import { Badge } from '../../../components/Badge'
import { ButtonLink } from '../../../components/Button'
import { Icon, type IconName } from '../../../components/Icon'
import { formatPercent, formatScore } from '../../../lib/format'
import { formatDateTime, formatRelative, formatShortDate, formatTime, remainingMs } from '../../../lib/time'
import { useLanguage } from '../../../i18n/LanguageContext'
import { Timer } from '../takeQuiz/QuizHeader'
import { displayPercentage, isShortOnTime } from '../studentQuizCopy'

/** A quiz on the student's list (prototype: "Your quizzes"). */
export function QuizCard({ quiz, nowMs, offsetMs }: { quiz: StudentQuizCard; nowMs: number; offsetMs: number }) {
  const { t } = useLanguage()
  const inProgress = quiz.status === 'InProgress'

  return (
    <article
      className={`flex flex-col gap-3 rounded-sheet bg-paper ${inProgress ? 'border-2 border-ink p-[15px]' : 'border border-rule p-4'}`}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge kind={quiz.status} />
        <span dir="auto" className="min-w-0 truncate text-meta text-muted">
          {quiz.teacherName}
        </span>
      </div>

      <h3 dir="auto" className="auto-text w-fit max-w-full text-card leading-[1.45] font-bold">
        {quiz.title}
      </h3>

      <FactsRow quiz={quiz} inset={inProgress ? 15 : 16} />

      <InfoLine icon="info">
        {quiz.wrongAnswerPenaltyPercent === 0 ? t.student.markingNone : t.student.markingLine(quiz.wrongAnswerPenaltyPercent)}
      </InfoLine>

      <StatusDetails quiz={quiz} nowMs={nowMs} offsetMs={offsetMs} />
    </article>
  )
}

/** Questions · points · time limit, ruled edge to edge across the card. */
export function FactsRow({ quiz, inset }: { quiz: StudentQuizCard; inset: 15 | 16 }) {
  const { t } = useLanguage()
  const cells = [
    { value: `${quiz.questionCount}`, label: t.student.factQuestions },
    { value: `${quiz.maxScore}`, label: t.student.factPoints },
    { value: t.student.minutesShort(quiz.durationMinutes), label: t.student.factTime },
  ]
  return (
    <div className={`flex border-y border-rule-soft ${inset === 15 ? '-mx-[15px]' : '-mx-4'}`}>
      {cells.map((cell, index) => (
        <div key={cell.label} className={`flex min-w-0 flex-1 flex-col gap-0.5 px-2.5 py-2 ${index > 0 ? 'border-s border-rule-soft' : ''}`}>
          <span className="text-body font-semibold tabular-nums">{cell.value}</span>
          <span className="text-[12px] text-muted">{cell.label}</span>
        </div>
      ))}
    </div>
  )
}

function InfoLine({ icon, children, tone = 'text-ink-2', align = 'center' }: { icon: IconName; children: ReactNode; tone?: string; align?: 'center' | 'start' }) {
  return (
    <div className={`flex gap-1.5 text-small leading-[1.45] ${tone} ${align === 'center' ? 'items-center' : 'items-start'}`}>
      <span className={align === 'start' ? 'pt-px' : ''}>
        <Icon name={icon} className="size-4" />
      </span>
      <span>{children}</span>
    </div>
  )
}

function StatusDetails({ quiz, nowMs, offsetMs }: { quiz: StudentQuizCard; nowMs: number; offsetMs: number }) {
  const { t, lang } = useLanguage()
  switch (quiz.status) {
    case 'InProgress':
      if (!quiz.attempt) return null
      return (
        <>
          <div className="flex flex-wrap items-center gap-2.5">
            <Timer remainingMs={remainingMs(quiz.attempt.deadline, offsetMs)} />
            <span className="text-small text-ink-2">{t.student.leftEndsAt(formatTime(quiz.attempt.deadline))}</span>
          </div>
          <ButtonLink to={`/student/attempts/${quiz.attempt.id}`} size="lg" className="w-full">
            {t.student.resume}
            <Icon name="chevronRight" className="size-[18px]" />
          </ButtonLink>
        </>
      )

    case 'Available':
      return (
        <>
          {isShortOnTime(quiz) && (
            <InfoLine icon="alert" tone="text-amber-ink font-semibold" align="start">
              {t.student.shortWarning(t.student.onlyMinutes(quiz.effectiveMinutesIfStartedNow ?? 0), formatTime(quiz.closesAt))}
            </InfoLine>
          )}
          <InfoLine icon="calendar" align="start">
            {t.student.closesLine(formatDateTime(quiz.closesAt, lang), formatRelative(quiz.closesAt, nowMs, lang))}
          </InfoLine>
          <ButtonLink to={`/student/quizzes/${quiz.id}`} variant="secondary" size="lg" className="w-full">
            {t.student.viewQuiz}
          </ButtonLink>
        </>
      )

    case 'Upcoming':
      return (
        <InfoLine icon="clock" align="start">
          {t.student.opensLine(formatDateTime(quiz.opensAt, lang), formatRelative(quiz.opensAt, nowMs, lang))}
        </InfoLine>
      )

    case 'Completed': {
      const attempt = quiz.attempt
      if (!attempt) return null
      const score = attempt.score ?? 0
      return (
        <>
          <div className="flex items-baseline justify-between rounded-option bg-desk px-3 py-2.5">
            <span className="text-small text-ink-2">{t.student.yourScore}</span>
            <span className={`text-card font-bold ${score < 0 ? 'text-red' : ''}`}>
              <Num>
                {formatScore(score)} / {attempt.maxScore}
              </Num>
              <span className="text-small font-medium text-muted">
                {' · '}
                <Num>{formatPercent(displayPercentage(score, attempt.maxScore))}</Num>
              </span>
            </span>
          </div>
          <InfoLine icon={attempt.status === 'Expired' ? 'hourglass' : 'check'} align="start">
            {attempt.status === 'Expired'
              ? t.student.timeRanOutOn(formatShortDate(attempt.deadline, lang))
              : t.student.submittedOn(formatShortDate(attempt.deadline, lang))}
          </InfoLine>
          <ButtonLink to={`/student/attempts/${attempt.id}/result`} variant="secondary" size="lg" className="w-full">
            {t.student.viewResult}
          </ButtonLink>
        </>
      )
    }

    case 'Missed':
      return (
        <InfoLine icon="minusCircle" tone="text-muted" align="start">
          {t.student.missedLine(formatDateTime(quiz.closesAt, lang))}
        </InfoLine>
      )
  }
}
