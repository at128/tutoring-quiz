import { useState } from 'react'
import { useFieldArray, type UseFormReturn } from 'react-hook-form'
import { Num } from '../../../components/Auto'
import { Icon } from '../../../components/Icon'
import { optionLabel } from '../../../lib/dir'
import type { EditorValues, Problems } from './editorForm'
import { useLanguage } from '../../../i18n/LanguageContext'
import type { Messages } from '../../../i18n/en'
import { emptyQuestion, LIMITS, problemsOfQuestion } from './editorForm'
import { FieldProblems, TextArea, TextInput } from './fields'

type Props = { form: UseFormReturn<EditorValues>; problems: Problems }

const iconButton =
  'inline-flex size-11 flex-none items-center justify-center rounded-control text-ink hover:bg-tint disabled:cursor-not-allowed disabled:opacity-40'

/** Question list: one card per open question, one ruled row per collapsed question, and "Add question". */
export function QuestionsSection({ form, problems }: Props) {
  const { t } = useLanguage()
  const m = t.editor
  const { control, watch } = form
  const questions = useFieldArray({ control, name: 'questions' })
  const values = watch('questions')
  const totalPoints = values.reduce((sum, q) => sum + (Number.parseInt(q.points, 10) || 0), 0)

  // Each question's uid is stable across moves, so an open question stays open when it moves.
  // Phones show one question at a time; wider screens can keep several open.
  const [open, setOpen] = useState<Set<string>>(() => new Set(values.slice(0, 1).map((q) => q.uid)))
  const isOpen = (uid: string, index: number) => open.has(uid) || problemsOfQuestion(problems, index).length > 0
  const openQuestion = (uid: string) =>
    setOpen((current) => (window.matchMedia('(min-width: 1024px)').matches ? new Set([...current, uid]) : new Set([uid])))

  function addQuestion() {
    const question = emptyQuestion()
    questions.append(question)
    openQuestion(question.uid)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-card font-bold">
          {m.questions}{' '}
          <span className="font-medium text-muted">
            <Num>{questions.fields.length}</Num>
          </span>
        </h2>
        <span className="text-small text-ink-2">{m.totalPoints(totalPoints)}</span>
      </div>
      <FieldProblems messages={problems.questions} />

      {questions.fields.map((field, index) =>
        isOpen(values[index]?.uid ?? field.id, index) ? (
          <QuestionEditor
            key={field.id}
            form={form}
            index={index}
            count={questions.fields.length}
            problems={problems}
            onMove={(to) => questions.move(index, to)}
            onRemove={() => questions.remove(index)}
          />
        ) : (
          <CollapsedQuestion
            key={field.id}
            index={index}
            text={values[index]?.text ?? ''}
            points={values[index]?.points ?? ''}
            problem={collapsedProblem(problems, index, m)}
            onOpen={() => openQuestion(values[index]?.uid ?? field.id)}
          />
        ),
      )}

      {questions.fields.length < LIMITS.questionsMax && (
        <button
          type="button"
          onClick={addQuestion}
          className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-option border-[1.5px] border-dashed border-strong bg-paper text-body font-semibold text-ink hover:bg-tint"
        >
          <Icon name="plus" className="size-[18px]" />
          {m.addQuestion}
        </button>
      )}
    </div>
  )
}

/** Short label for a closed question with problems ("Needs a correct answer"). */
function collapsedProblem(problems: Problems, index: number, m: Messages['editor']): string | null {
  const entries = problemsOfQuestion(problems, index)
  if (entries.length === 0) return null
  return entries.some(([, messages]) => messages.includes(m.needsCorrect)) ? m.needsCorrectShort : m.needsAttention
}

function CollapsedQuestion({ index, text, points, problem, onOpen }: { index: number; text: string; points: string; problem: string | null; onOpen: () => void }) {
  const { t } = useLanguage()
  const pts = Number.parseInt(points, 10) || 0
  return (
    <button
      type="button"
      aria-expanded={false}
      onClick={onOpen}
      className={`flex min-h-[52px] w-full items-center gap-3 rounded-option bg-paper px-3 py-2 text-start text-ink hover:bg-tint ${
        problem ? 'border-2 border-red' : 'border border-rule'
      }`}
    >
      <span className="w-7 flex-none text-small font-bold text-ink-2">
        <Num>{index + 1}</Num>
      </span>
      <span dir="auto" className="min-w-0 flex-1 truncate text-[15px]">
        {text || <span className="text-muted">{t.editor.untitled}</span>}
      </span>
      {problem && (
        <span className="flex flex-none items-center gap-1 text-meta font-semibold text-red">
          <Icon name="alert" className="size-4" strokeWidth={2} />
          {problem}
        </span>
      )}
      <span className="flex-none text-meta text-muted">{t.editor.ptsShort(pts)}</span>
      <Icon name="chevronRight" className="size-[18px] text-muted" />
    </button>
  )
}

type EditorProps = {
  form: UseFormReturn<EditorValues>
  index: number
  count: number
  problems: Problems
  onMove: (to: number) => void
  onRemove: () => void
}

function QuestionEditor({ form, index, count, problems, onMove, onRemove }: EditorProps) {
  const { t } = useLanguage()
  const m = t.editor
  const { control, register, watch, setValue } = form
  const options = useFieldArray({ control, name: `questions.${index}.options` })
  const prefix = `questions[${index}]`
  const text = watch(`questions.${index}.text`)
  const correct = watch(`questions.${index}.correct`)
  const hasProblems = problemsOfQuestion(problems, index).length > 0
  const number = index + 1

  function removeOption(j: number) {
    const current = Number(correct)
    options.remove(j)
    if (correct === '') return
    if (current === j) setValue(`questions.${index}.correct`, '', { shouldDirty: true })
    else if (current > j) setValue(`questions.${index}.correct`, String(current - 1), { shouldDirty: true })
  }

  return (
    <section
      aria-labelledby={`q${index}-title`}
      className={`flex flex-col gap-3.5 rounded-sheet bg-paper p-4 ${hasProblems ? 'border-2 border-red' : 'border border-rule'}`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 id={`q${index}-title`} className="text-body font-bold">
            {m.questionN(number)}
          </h3>
          <div className="flex items-center gap-2">
            <label htmlFor={`q${index}-points`} className="text-small text-ink-2">
              {m.pointsLabel}
            </label>
            <TextInput
              id={`q${index}-points`}
              type="number"
              lang="en"
              inputMode="numeric"
              min={LIMITS.pointsMin}
              max={LIMITS.pointsMax}
              compact
              invalid={!!problems[`${prefix}.points`]}
              className="w-[72px] px-2.5"
              {...register(`questions.${index}.points`)}
            />
          </div>
        </div>
        <div className="flex gap-0.5">
          <button type="button" aria-label={m.moveUp(number)} disabled={index === 0} onClick={() => onMove(index - 1)} className={iconButton}>
            <Icon name="arrowUp" className="size-[18px]" />
          </button>
          <button type="button" aria-label={m.moveDown(number)} disabled={index === count - 1} onClick={() => onMove(index + 1)} className={iconButton}>
            <Icon name="arrowDown" className="size-[18px]" />
          </button>
          <button type="button" aria-label={m.deleteQuestion(number)} onClick={onRemove} className={`${iconButton} text-red hover:bg-red-bg`}>
            <Icon name="trash" className="size-[18px]" />
          </button>
        </div>
      </div>
      <FieldProblems messages={problems[`${prefix}.points`]} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`q${index}-text`} className="text-small font-semibold">
          {m.questionText}
        </label>
        <TextArea id={`q${index}-text`} rows={2} large invalid={!!problems[`${prefix}.text`]} {...register(`questions.${index}.text`)} />
        <FieldProblems messages={problems[`${prefix}.text`]} />
      </div>

      <div className="flex flex-col gap-2" role="radiogroup" aria-label={m.correctFor(number)}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-small font-semibold">{m.options}</span>
          <span className="text-meta text-muted">{m.optionsHint}</span>
        </div>

        {options.fields.map((option, j) => {
          const letter = optionLabel(j, text)
          const isCorrect = correct === String(j)
          const optionKey = `${prefix}.options[${j}].text`
          return (
            <div key={option.id} className="flex flex-col gap-1">
              <div
                className={`flex items-center gap-2 rounded-option ${
                  isCorrect ? 'border-2 border-green bg-green-bg px-[7px] py-[5px]' : 'border border-rule bg-paper px-2 py-1.5'
                }`}
              >
                <label className="flex size-11 flex-none cursor-pointer items-center justify-center" title={m.markCorrect}>
                  <input
                    type="radio"
                    value={String(j)}
                    checked={isCorrect}
                    onChange={() => setValue(`questions.${index}.correct`, String(j), { shouldDirty: true })}
                    aria-label={m.optionIsCorrect(letter)}
                    className="size-[22px] accent-green"
                  />
                </label>
                <span aria-hidden className="w-[26px] flex-none text-center text-small font-bold text-ink-2">
                  {letter}
                </span>
                <TextInput
                  aria-label={m.optionText(letter)}
                  dir="auto"
                  compact
                  invalid={!!problems[optionKey]}
                  className="min-w-0 flex-1"
                  {...register(`questions.${index}.options.${j}.text`)}
                />
                {isCorrect && (
                  <span className="hidden flex-none items-center gap-1 text-[12px] font-bold text-green sm:inline-flex">
                    <Icon name="check" className="size-3.5" strokeWidth={2.2} />
                    {m.correct}
                  </span>
                )}
                <button
                  type="button"
                  aria-label={m.removeOption(letter)}
                  disabled={options.fields.length <= LIMITS.optionsMin}
                  onClick={() => removeOption(j)}
                  className={`${iconButton} text-ink-2`}
                >
                  <Icon name="x" className="size-[18px]" />
                </button>
              </div>
              <FieldProblems messages={problems[optionKey]} />
            </div>
          )
        })}

        {problems[`${prefix}.options`] && (
          <FieldProblems messages={problems[`${prefix}.options`]} />
        )}

        {options.fields.length < LIMITS.optionsMax && (
          <button
            type="button"
            onClick={() => options.append({ text: '' })}
            className="inline-flex min-h-11 items-center gap-2 self-start rounded-control px-[18px] text-body font-semibold text-ink underline underline-offset-[3px] hover:bg-tint"
          >
            <Icon name="plus" className="size-[18px]" />
            {m.addOption}
          </button>
        )}
      </div>
    </section>
  )
}
