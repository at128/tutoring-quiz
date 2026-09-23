import { useRef, type KeyboardEvent } from 'react'
import type { AttemptQuestion } from '../../../api/types'
import { Auto, Num } from '../../../components/Auto'
import { Icon } from '../../../components/Icon'
import { Spinner } from '../../../components/Spinner'
import { optionLabel } from '../../../lib/dir'
import { plural } from '../../../lib/format'
import type { Answer } from './answers'

type QuestionCardProps = {
  question: AttemptQuestion
  number: number
  total: number
  answer: Answer | undefined
  /** No changes while submitting. */
  disabled: boolean
  /** Time is up: answers are closed for good. */
  closed: boolean
  onChoose: (optionId: string | null) => void
  onRetry: () => void
}

/** One question: options as an answer-sheet radio group, save status, and "Clear answer". */
export function QuestionCard({ question, number, total, answer, disabled, closed, onChoose, onRetry }: QuestionCardProps) {
  const labelId = `question-${question.id}`
  const selected = answer?.desired ?? null
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([])

  // Radio-group keyboard behaviour: arrows move to (and choose) the next / previous option.
  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const step = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0 || disabled) return
    event.preventDefault()
    const next = (index + step + question.options.length) % question.options.length
    optionRefs.current[next]?.focus()
    onChoose(question.options[next].id)
  }

  const focusableIndex = Math.max(0, question.options.findIndex((o) => o.id === selected))

  return (
    <section className="flex flex-col gap-3.5 rounded-sheet border border-rule bg-paper p-4">
      <div className="flex items-center justify-between border-b border-rule pb-2.5">
        <span id={labelId} className="text-small font-semibold text-ink-2">
          Question <Num>{number}</Num> of <Num>{total}</Num>
        </span>
        <span className="rounded-full border border-rule px-2.5 py-0.5 text-meta font-semibold text-ink">
          <Num>{plural(question.points, 'point')}</Num>
        </span>
      </div>

      <Auto as="p" className="block text-question font-semibold whitespace-pre-wrap">
        {question.text}
      </Auto>

      <div role="radiogroup" aria-labelledby={labelId} aria-disabled={disabled || undefined} className="flex flex-col gap-2.5">
        {question.options.map((option, index) => {
          const isSelected = option.id === selected
          return (
            <button
              key={option.id}
              ref={(element) => {
                optionRefs.current[index] = element
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              tabIndex={index === focusableIndex ? 0 : -1}
              disabled={disabled}
              dir="auto"
              onClick={() => !isSelected && onChoose(option.id)}
              onKeyDown={(event) => handleKeyDown(event, index)}
              className={`flex min-h-14 w-full items-center gap-3.5 rounded-option text-start text-option text-ink transition-colors duration-150 disabled:cursor-not-allowed ${
                isSelected
                  ? 'border-2 border-ink bg-tint px-[13px] py-[11px] font-medium'
                  : 'border border-rule bg-paper px-3.5 py-3 enabled:hover:border-strong'
              } ${closed ? 'opacity-60' : ''}`}
            >
              <span
                aria-hidden
                className={`flex size-[30px] flex-none items-center justify-center rounded-full border-[1.5px] text-small font-semibold ${
                  isSelected
                    ? 'border-ink bg-ink text-paper'
                    : closed
                      ? 'border-rule bg-paper text-[#6B7690]'
                      : 'border-muted bg-paper text-ink-2'
                }`}
              >
                {optionLabel(index, question.text)}
              </span>
              <span className="auto-text flex-1 [unicode-bidi:isolate]">{option.text}</span>
              {isSelected && <Icon name="check" className="size-5 text-ink" />}
            </button>
          )
        })}
      </div>

      <div className="flex flex-col gap-0.5">
        {closed ? (
          <p role="status" className="flex min-h-6 items-center gap-1.5 text-small text-muted">
            <Icon name="lock" className="size-4" />
            Answers are closed
          </p>
        ) : (
          <SaveStatus answer={answer} onRetry={onRetry} />
        )}
        {selected !== null && !disabled && !closed && (
          <button
            type="button"
            onClick={() => onChoose(null)}
            className="-ms-2.5 min-h-11 self-start px-2.5 text-small font-semibold text-ink underline underline-offset-[3px]"
          >
            Clear answer
          </button>
        )}
      </div>
    </section>
  )
}

function SaveStatus({ answer, onRetry }: { answer: Answer | undefined; onRetry: () => void }) {
  if (!answer || (answer.desired === null && answer.status === 'saved'))
    return <p className="min-h-6 text-small text-muted">Not answered yet</p>

  if (answer.status === 'saving')
    return (
      <p role="status" className="flex min-h-6 items-center gap-2 text-small text-muted">
        <Spinner className="size-4" />
        Saving…
      </p>
    )

  if (answer.status === 'failed')
    return (
      <div role="status" className="flex min-h-6 items-center justify-between gap-2 text-small font-medium text-red">
        <span className="flex items-center gap-1.5">
          <Icon name="alert" className="size-4" />
          Not saved yet — retrying
        </span>
        <button type="button" onClick={onRetry} className="min-h-9 rounded-control border border-red-line px-2.5 font-semibold">
          Retry now
        </button>
      </div>
    )

  return (
    <p role="status" className="flex min-h-6 items-center gap-1.5 text-small font-medium text-green">
      <Icon name="check" className="size-4" />
      {answer.desired === null ? 'Answer cleared' : 'Saved'}
    </p>
  )
}
