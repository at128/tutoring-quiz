import { Link } from 'react-router'
import { Num } from '../../../components/Auto'
import { Button, ButtonLink } from '../../../components/Button'
import { Dialog } from '../../../components/Dialog'
import { Icon } from '../../../components/Icon'
import { Spinner } from '../../../components/Spinner'
import { plural } from '../../../lib/format'
import { isAnswered, type Answers } from './answers'
import { noticeText, type TimeNotice } from './timer'

const footerButton =
  'flex min-h-12 w-full items-center justify-center gap-2 rounded-control border px-4 text-body font-semibold'

/** Previous / Next; on the last question Next becomes "Submit quiz". Sits above the safe-area inset. */
export function QuizFooter({
  isFirst,
  isLast,
  locked,
  onPrevious,
  onNext,
  onSubmit,
}: {
  isFirst: boolean
  isLast: boolean
  locked: boolean
  onPrevious: () => void
  onNext: () => void
  onSubmit: () => void
}) {
  return (
    <footer className="relative z-[2] flex-none border-t border-rule bg-paper pb-[calc(12px+env(safe-area-inset-bottom))]">
      <div className="mx-auto flex w-full max-w-[640px] gap-2.5 px-4 pt-3">
        <div className="flex-1">
          <button
            type="button"
            disabled={isFirst}
            onClick={onPrevious}
            className={`${footerButton} ${isFirst ? 'border-rule-soft bg-rule-soft text-[#6B7690]' : 'border-strong bg-paper text-ink hover:bg-tint'}`}
          >
            <Icon name="chevronLeft" className="size-[18px]" />
            Previous
          </button>
        </div>
        <div className="flex-1">
          {isLast ? (
            <button type="button" disabled={locked} onClick={onSubmit} className={`${footerButton} border-ink bg-ink text-paper hover:bg-ink-2 disabled:opacity-60`}>
              Submit quiz
            </button>
          ) : (
            <button type="button" onClick={onNext} className={`${footerButton} border-ink bg-ink text-paper hover:bg-ink-2`}>
              Next
              <Icon name="chevronRight" className="size-[18px]" />
            </button>
          )}
        </div>
      </div>
    </footer>
  )
}

/** Bottom sheet with every question: answered (filled), not answered (hollow), current (ring), not saved (!). */
export function QuestionNavigator({
  open,
  questionIds,
  currentIndex,
  answers,
  locked,
  onClose,
  onGoTo,
  onSubmit,
}: {
  open: boolean
  questionIds: string[]
  currentIndex: number
  answers: Answers
  locked: boolean
  onClose: () => void
  onGoTo: (index: number) => void
  onSubmit: () => void
}) {
  const answered = questionIds.filter((id) => isAnswered(answers[id])).length

  return (
    <Dialog open={open} onClose={onClose} variant="sheet" labelledBy="navigator-title">
      <div className="flex flex-col gap-3.5">
        <div aria-hidden className="h-1 w-10 self-center rounded-full bg-rule" />
        <div className="flex items-center justify-between">
          <h2 id="navigator-title" className="text-card font-bold">
            Questions
          </h2>
          <button type="button" aria-label="Close" onClick={onClose} className="inline-flex size-11 items-center justify-center rounded-control text-ink hover:bg-tint">
            <Icon name="x" />
          </button>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-2 text-meta text-ink-2">
          <Legend swatch="bg-ink">Answered</Legend>
          <Legend swatch="border-[1.5px] border-muted">Not answered</Legend>
          <Legend swatch="border-[1.5px] border-muted shadow-[0_0_0_2px_#fff,0_0_0_3.5px_#1D2B4F]">Current</Legend>
        </div>

        <ol className="grid grid-cols-5 justify-items-center gap-x-2 gap-y-3">
          {questionIds.map((id, index) => {
            const answer = answers[id]
            const failed = answer?.status === 'failed'
            const filled = isAnswered(answer)
            const current = index === currentIndex
            const state = failed ? 'not saved yet' : filled ? 'answered' : 'not answered'
            const look = failed
              ? 'border-2 border-red bg-ink text-paper'
              : filled
                ? 'border-2 border-ink bg-ink text-paper'
                : 'border-[1.5px] border-muted bg-paper text-ink'
            return (
              <li key={id}>
                <button
                  type="button"
                  aria-label={`Question ${index + 1}, ${state}`}
                  aria-current={current ? 'step' : undefined}
                  onClick={() => onGoTo(index)}
                  className={`relative flex size-12 items-center justify-center rounded-full p-0 text-body font-semibold ${look} ${
                    current ? 'shadow-[0_0_0_3px_#fff,0_0_0_5px_#1D2B4F]' : ''
                  }`}
                >
                  <Num>{index + 1}</Num>
                  {failed && (
                    <span aria-hidden className="absolute -top-1 -end-1 flex size-[18px] items-center justify-center rounded-full border-2 border-paper bg-red text-[12px] font-bold text-paper">
                      !
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ol>

        <div aria-hidden className="border-t border-rule" />
        <p className="text-small text-ink-2">
          <strong className="text-ink">
            <Num>{answered}</Num> answered
          </strong>{' '}
          · <Num>{questionIds.length - answered}</Num> not answered
        </p>
        <Button size="lg" className="w-full" disabled={locked} onClick={onSubmit}>
          Submit quiz
        </Button>
        <Link to="/student" className="flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-control text-ink hover:bg-tint">
          <span className="text-[15px] font-semibold underline underline-offset-[3px]">Leave for now</span>
          <span className="text-[12px] text-muted">Answers are saved. The timer keeps running.</span>
        </Link>
      </div>
    </Dialog>
  )
}

function Legend({ swatch, children }: { swatch: string; children: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-3.5 rounded-full ${swatch}`} />
      {children}
    </span>
  )
}

/** Confirmation: unanswered question numbers, answers still being sent, and the marking rule. */
export function SubmitDialog({
  open,
  unanswered,
  penaltyPercent,
  pendingCount,
  submitting,
  canCancel,
  onCancel,
  onConfirm,
}: {
  open: boolean
  unanswered: number[]
  penaltyPercent: number
  pendingCount: number
  submitting: boolean
  /** False once the submit request itself is on its way. */
  canCancel: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog open={open} onClose={onCancel} role="alertdialog" labelledBy="submit-title" dismissible={canCancel}>
      <div className="flex flex-col gap-3.5">
        <h2 id="submit-title" className="text-[20px] font-bold">
          Submit quiz?
        </h2>

        {unanswered.length > 0 ? (
          <div className="flex gap-2.5 rounded-option border border-amber-line bg-amber-bg p-3 text-[15px] text-ink">
            <Icon name="alert" className="mt-0.5 size-5 text-amber-ink" />
            <p>
              <strong>
                {unanswered.length === 1 ? '1 question isn’t answered' : `${unanswered.length} questions aren’t answered`}
              </strong>{' '}
              (<Num>{joinNumbers(unanswered)}</Num>). They’ll score 0.
            </p>
          </div>
        ) : (
          <p className="flex gap-2.5 text-[15px]">
            <Icon name="check" className="size-5 text-green" />
            All questions are answered.
          </p>
        )}

        {pendingCount > 0 && (
          <p className="flex gap-2.5 text-small text-red">
            <Icon name="refresh" className="size-5" />
            {pendingCount === 1 ? '1 answer is waiting to be sent.' : `${pendingCount} answers are waiting to be sent.`} It will be
            sent before submitting.
          </p>
        )}

        <ul className="flex flex-col gap-1.5 text-small text-ink-2">
          <li>
            {penaltyPercent > 0
              ? `A wrong answer loses ${penaltyPercent}% of that question’s points.`
              : 'There’s no negative marking on this quiz.'}
          </li>
          <li>You can’t change answers after submitting.</li>
        </ul>

        <div className="flex flex-col gap-2.5 pt-1">
          <Button size="lg" loading={submitting} onClick={onConfirm}>
            Submit quiz
          </Button>
          <Button variant="secondary" size="lg" disabled={!canCancel} onClick={onCancel}>
            Keep answering
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

/** "4, 9 and 12" */
function joinNumbers(numbers: number[]) {
  return numbers.length <= 1 ? numbers.join('') : `${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`
}

/** At 0:00: answers are closed and the saved ones are being submitted. */
export function TimeUpDialog({ resultHref, stillTrying }: { resultHref: string; stillTrying: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-center bg-[rgb(29_43_79/0.48)]">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="time-up-title"
        className="mx-4 flex flex-col items-center gap-3 rounded-dialog bg-paper px-5 py-6 text-center sm:mx-auto sm:w-full sm:max-w-[400px]"
      >
        <span className="flex size-14 items-center justify-center rounded-full bg-red-bg text-red">
          <Icon name="hourglass" className="size-7" />
        </span>
        <h2 id="time-up-title" className="text-page font-bold">
          Time’s up
        </h2>
        <p className="text-[15px] leading-[1.55] text-ink-2">
          Answers are closed. Your saved answers are being submitted — you don’t need to do anything.
        </p>
        <p role="status" className="flex items-center gap-2 text-small text-muted">
          <Spinner className="size-4" />
          {stillTrying ? 'Waiting for a connection…' : 'Submitting…'}
        </p>
        <ButtonLink to={resultHref} variant="secondary" size="lg" className="w-full" replace>
          See your result
        </ButtonLink>
      </div>
    </div>
  )
}

export function ConnectionBanner({ pendingCount, onRetry }: { pendingCount: number; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-option border border-red-line bg-red-bg px-3.5 py-3">
      <Icon name="wifiOff" className="mt-px size-5 text-red" />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-[15px] font-semibold text-red">Connection lost — retrying</p>
        <p className="text-small leading-normal text-ink-2">
          Answers already saved are safe.
          {pendingCount > 0 && ` ${plural(pendingCount, 'answer is', 'answers are')} waiting to be sent.`}
        </p>
      </div>
      <button type="button" onClick={onRetry} className="min-h-9 flex-none rounded-control border border-red-line bg-paper px-2.5 text-small font-semibold text-red">
        Retry now
      </button>
    </div>
  )
}

export function TimeNoticeBanner({ notice }: { notice: TimeNotice }) {
  const final = notice === '1min'
  return (
    <div
      role="status"
      className={`flex items-center gap-2 rounded-option border px-3 py-2.5 text-[15px] font-semibold ${
        final ? 'border-red bg-red-bg text-red' : 'border-amber bg-amber-bg text-amber-ink'
      }`}
    >
      <Icon name="clock" className="size-[18px]" />
      {noticeText[notice]}
    </div>
  )
}
