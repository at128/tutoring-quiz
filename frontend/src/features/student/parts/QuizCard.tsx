import type { StudentQuizCard } from '../../../api/types'
import { Auto, Num } from '../../../components/Auto'
import { Badge } from '../../../components/Badge'
import { ButtonLink } from '../../../components/Button'
import { Icon } from '../../../components/Icon'
import { Sheet } from '../../../components/Sheet'
import { formatScore } from '../../../lib/format'
import { cardAction, isShortOnTime, shortTimeMessage, timeHint } from '../studentQuizCopy'

export function QuizCard({ quiz, nowMs }: { quiz: StudentQuizCard; nowMs: number }) {
  const action = cardAction(quiz)
  const score = quiz.status === 'Completed' ? quiz.attempt?.score : null

  return (
    <Sheet as="article" className="p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Badge kind={quiz.status} />
        <Auto className="min-w-0 truncate text-small text-ink-2">{quiz.teacherName}</Auto>
      </div>

      <Auto as="h3" className="mt-2 block text-card font-bold">
        {quiz.title}
      </Auto>

      {isShortOnTime(quiz) && (
        <p className="mt-3 flex items-start gap-2 rounded-option border border-amber-line bg-amber-bg px-3 py-2 text-small text-amber-ink">
          <Icon name="clock" className="mt-0.5 size-4" />
          {shortTimeMessage(quiz)}
        </p>
      )}

      <dl className="mt-3 grid grid-cols-3 divide-x divide-rule-soft rounded-option border border-rule-soft text-center">
        <Fact label="Questions" value={quiz.questionCount} />
        <Fact label="Minutes" value={quiz.durationMinutes} />
        <Fact label="Max score" value={quiz.maxScore} />
      </dl>

      <p className="mt-3 text-small text-ink-2">
        {quiz.wrongAnswerPenaltyPercent > 0
          ? `Negative marking: −${quiz.wrongAnswerPenaltyPercent} % of a question's points for a wrong answer`
          : 'No negative marking'}
      </p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-rule-soft pt-3">
        <p className="min-w-0 flex-1 text-small text-ink">
          {score !== null && score !== undefined && quiz.attempt ? (
            <span className="me-2 font-semibold">
              Score{' '}
              <Num className={score < 0 ? 'text-red' : ''}>
                {formatScore(score)} / {quiz.attempt.maxScore}
              </Num>
              {' · '}
            </span>
          ) : null}
          {timeHint(quiz, nowMs)}
        </p>
        {action && (
          <ButtonLink to={action.to} variant={action.variant} className="w-full sm:w-auto">
            {action.label}
          </ButtonLink>
        )}
      </div>
    </Sheet>
  )
}

function Fact({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-2 py-2">
      <dt className="text-meta text-muted">{label}</dt>
      <dd className="text-body font-semibold">
        <Num>{value}</Num>
      </dd>
    </div>
  )
}
