import type { UseFormReturn } from 'react-hook-form'
import type { TeacherClassRoom } from '../../../api/types'
import { Segmented } from '../../../components/ClassChip'
import { Skeleton } from '../../../components/States'
import type { EditorValues, PenaltyChoice, Problems } from './editorForm'
import { localTimeZoneLabel, penaltyPercent } from './editorForm'
import { FieldProblems, Hint, Label, TextArea, TextInput } from './fields'

const PENALTY_OPTIONS: { value: PenaltyChoice; label: string }[] = [
  { value: '0', label: 'None' },
  { value: '25', label: '25%' },
  { value: '33', label: '33%' },
  { value: '50', label: '50%' },
  { value: 'custom', label: 'Custom' },
]

const markingHint = (percent: number | null) =>
  percent === null || percent === 0
    ? 'Wrong answers cost nothing. Unanswered questions always score 0.'
    : `A wrong answer loses ${percent}% of that question’s points. Unanswered questions always score 0.`

type Props = {
  form: UseFormReturn<EditorValues>
  classRooms: TeacherClassRoom[] | undefined
  problems: Problems
}

/** Title, description, classes, window, time limit and negative marking (prototype: "Edit quiz" → Details). */
export function DetailsSection({ form, classRooms, problems }: Props) {
  const { register, watch, setValue } = form
  const selected = watch('classRoomIds')
  const penalty = watch('penalty')
  const percent = penaltyPercent({ penalty, customPenalty: watch('customPenalty') })

  function toggleClass(id: string, checked: boolean) {
    const next = checked ? [...selected, id] : selected.filter((c) => c !== id)
    setValue('classRoomIds', next, { shouldDirty: true })
  }

  return (
    <section className="flex flex-col gap-[18px] rounded-sheet border border-rule bg-paper p-5">
      <h2 className="text-card font-bold">Details</h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">Title</Label>
        <TextInput id="title" dir="auto" invalid={!!problems.title} aria-describedby="title-problems" {...register('title')} />
        <FieldProblems id="title-problems" messages={problems.title} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">Description (optional)</Label>
        <TextArea id="description" rows={2} invalid={!!problems.description} {...register('description')} />
        {problems.description ? <FieldProblems messages={problems.description} /> : <Hint>Shown to students before they start.</Hint>}
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-small font-semibold">Classes</legend>
        {classRooms ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {classRooms.map((classRoom) => {
              const checked = selected.includes(classRoom.id)
              return (
                <label
                  key={classRoom.id}
                  className={`flex min-h-11 cursor-pointer items-center gap-2.5 rounded-control border px-3 ${
                    checked ? 'border-ink bg-tint' : 'border-rule bg-paper'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => toggleClass(classRoom.id, event.target.checked)}
                    className="size-5 accent-ink"
                  />
                  <span className="text-[15px] font-semibold text-ink">{classRoom.name}</span>
                  <span className="text-meta text-muted">{classRoom.studentCount} students</span>
                </label>
              )
            })}
          </div>
        ) : (
          <Skeleton className="h-11 w-full" />
        )}
        <FieldProblems messages={problems.classRoomIds} />
      </fieldset>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="opensAt">Opens</Label>
          <TextInput id="opensAt" type="datetime-local" invalid={!!problems.opensAt} {...register('opensAt')} />
          {problems.opensAt ? <FieldProblems messages={problems.opensAt} /> : <Hint>{localTimeZoneLabel()}</Hint>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="closesAt">Closes</Label>
          <TextInput id="closesAt" type="datetime-local" invalid={!!problems.closesAt} {...register('closesAt')} />
          {problems.closesAt ? <FieldProblems messages={problems.closesAt} /> : <Hint>Must be after the opening time</Hint>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="durationMinutes">Time limit</Label>
          <div className="flex items-center gap-2.5">
            <TextInput
              id="durationMinutes"
              type="number"
              inputMode="numeric"
              min={1}
              max={180}
              invalid={!!problems.durationMinutes}
              className="w-[110px]"
              {...register('durationMinutes')}
            />
            <span className="text-[15px] text-ink-2">minutes</span>
          </div>
          {problems.durationMinutes ? (
            <FieldProblems messages={problems.durationMinutes} />
          ) : (
            <Hint>1–180. Ends earlier if the quiz closes first.</Hint>
          )}
        </div>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-small font-semibold">Negative marking</legend>
        <Segmented
          label="Negative marking"
          options={PENALTY_OPTIONS}
          value={penalty}
          onChange={(value) => setValue('penalty', value, { shouldDirty: true })}
          className="-me-1 sm:me-0 [&_button]:px-2 sm:[&_button]:px-3"
        />
        {penalty === 'custom' && (
          <div className="flex items-center gap-2.5 pt-1">
            <TextInput
              aria-label="Custom negative marking in percent"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              compact
              invalid={!!problems.wrongAnswerPenaltyPercent}
              className="w-[96px]"
              {...register('customPenalty')}
            />
            <span className="text-[15px] text-ink-2">% of the question’s points</span>
          </div>
        )}
        {problems.wrongAnswerPenaltyPercent ? <FieldProblems messages={problems.wrongAnswerPenaltyPercent} /> : <Hint>{markingHint(percent)}</Hint>}
      </fieldset>
    </section>
  )
}
