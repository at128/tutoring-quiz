import { Auto, Num } from '../../../components/Auto'
import { Icon } from '../../../components/Icon'
import { formatCountdown } from '../../../lib/time'
import { isAnswered, type Answers } from './answers'
import { noticeText, timerPhase, type TimeNotice } from './timer'

const timerStyles = {
  normal: 'bg-tint border border-rule text-ink',
  warn: 'bg-amber-bg border-2 border-amber text-amber-ink',
  final: 'bg-red-bg border-2 border-red text-red',
  zero: 'bg-red border border-red text-paper',
} as const

export function Timer({ remainingMs }: { remainingMs: number }) {
  const text = formatCountdown(remainingMs)
  return (
    <span
      role="timer"
      aria-label={`Time left ${text}`}
      className={`inline-flex h-9 items-center gap-1.5 rounded-control px-3 ${timerStyles[timerPhase(remainingMs)]}`}
    >
      <Icon name="clock" className="size-[18px]" />
      <span dir="ltr" className="font-mono text-[18px] font-semibold tabular-nums">
        {text}
      </span>
    </span>
  )
}

type HeaderProps = {
  title: string
  remainingMs: number
  questionIds: string[]
  currentIndex: number
  answers: Answers
  notice: TimeNotice | null
  onOpenNavigator: () => void
}

/** Title, countdown, answered count, the Questions button and one tick per question. */
export function QuizHeader({ title, remainingMs, questionIds, currentIndex, answers, notice, onOpenNavigator }: HeaderProps) {
  const answered = questionIds.filter((id) => isAnswered(answers[id])).length

  return (
    <header className="flex-none border-b border-rule bg-paper pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex w-full max-w-[640px] flex-col gap-2 px-4 pt-2.5 pb-3">
        <Auto className="block truncate text-small font-semibold text-ink-2">{title}</Auto>
        <div className="flex items-center gap-2.5">
          <Timer remainingMs={remainingMs} />
          <span className="min-w-0 flex-1 text-small text-ink-2">
            <strong className="text-body text-ink">
              <Num>
                {answered} / {questionIds.length}
              </Num>
            </strong>{' '}
            answered
          </span>
          <button
            type="button"
            onClick={onOpenNavigator}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-control border border-strong bg-paper px-3 text-small font-semibold text-ink hover:bg-tint"
          >
            <Icon name="grid" className="size-[18px]" />
            Questions
          </button>
        </div>
        <ProgressTicks questionIds={questionIds} currentIndex={currentIndex} answers={answers} />
        <div className="sr-only" aria-live="polite">
          {notice ? noticeText[notice] : ''}
        </div>
      </div>
    </header>
  )
}

/** Decorative duplicate of the answered count (the button and counter carry the information). */
function ProgressTicks({ questionIds, currentIndex, answers }: { questionIds: string[]; currentIndex: number; answers: Answers }) {
  return (
    <div aria-hidden className="flex h-3 items-center gap-[3px]">
      {questionIds.map((id, index) => {
        const answer = answers[id]
        const current = index === currentIndex
        const style =
          answer?.status === 'failed'
            ? 'h-2 border-2 border-red bg-paper'
            : current
              ? `h-3 border-2 border-ink ${isAnswered(answer) ? 'bg-ink' : 'bg-paper'}`
              : isAnswered(answer)
                ? 'h-2 border border-ink bg-ink'
                : 'h-2 border border-rule bg-rule-soft'
        return <span key={id} className={`flex-1 rounded-[2px] ${style}`} />
      })}
    </div>
  )
}
