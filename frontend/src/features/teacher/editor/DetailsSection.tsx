import type { UseFormReturn } from 'react-hook-form'
import type { TeacherClassRoom } from '../../../api/types'
import { Segmented } from '../../../components/ClassChip'
import { Button } from '../../../components/Button'
import { Skeleton } from '../../../components/States'
import { useLanguage } from '../../../i18n/LanguageContext'
import type { Messages } from '../../../i18n/en'
import type { EditorValues, PenaltyChoice, Problems } from './editorForm'
import { localTimeZoneLabel, penaltyPercent } from './editorForm'
import { FieldProblems, Hint, Label, TextArea, TextInput } from './fields'

const penaltyOptions = (m: Messages['editor']): { value: PenaltyChoice; label: string }[] => [
  { value: '0', label: m.penaltyNone },
  { value: '25', label: '25%' },
  { value: '33', label: '33%' },
  { value: '50', label: '50%' },
  { value: 'custom', label: m.penaltyCustom },
]

const markingHint = (percent: number | null, m: Messages['editor']) =>
  percent === null || percent === 0 ? m.markingHintNone : m.markingHint(percent)

/** The class list as the page has it: loaded, still loading, or failed (with a way to try again). */
export type ClassRoomsState = { data: TeacherClassRoom[] | undefined; failed: boolean; retry: () => void }

type Props = {
  form: UseFormReturn<EditorValues>
  classRooms: ClassRoomsState
  problems: Problems
}

/** Title, description, classes, window, time limit and negative marking (prototype: "Edit quiz" → Details). */
export function DetailsSection({ form, classRooms, problems }: Props) {
  const { t } = useLanguage()
  const m = t.editor
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
      <h2 className="text-card font-bold">{m.details}</h2>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="title">{m.title}</Label>
        <TextInput id="title" dir="auto" invalid={!!problems.title} aria-describedby="title-problems" {...register('title')} />
        <FieldProblems id="title-problems" messages={problems.title} />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="description">{m.description}</Label>
        <TextArea id="description" rows={2} invalid={!!problems.description} {...register('description')} />
        {problems.description ? <FieldProblems messages={problems.description} /> : <Hint>{m.descriptionHint}</Hint>}
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-small font-semibold">{m.classes}</legend>
        {classRooms.data ? (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {classRooms.data.map((classRoom) => {
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
                  <span className="text-meta text-muted">{m.studentCount(classRoom.studentCount)}</span>
                </label>
              )
            })}
          </div>
        ) : classRooms.failed ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-control border border-red-line bg-red-bg px-3 py-2 text-small text-red">
            <span className="flex-1">{t.errors.didNotLoad}</span>
            <Button variant="secondary" onClick={classRooms.retry}>
              {t.errors.tryAgain}
            </Button>
          </div>
        ) : (
          <Skeleton className="h-11 w-full" />
        )}
        <FieldProblems messages={problems.classRoomIds} />
      </fieldset>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="opensAt">{m.opens}</Label>
          <TextInput id="opensAt" type="datetime-local" dir="ltr" lang="en" invalid={!!problems.opensAt} {...register('opensAt')} />
          {problems.opensAt ? <FieldProblems messages={problems.opensAt} /> : <Hint>{localTimeZoneLabel(m)}</Hint>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="closesAt">{m.closes}</Label>
          <TextInput id="closesAt" type="datetime-local" dir="ltr" lang="en" invalid={!!problems.closesAt} {...register('closesAt')} />
          {problems.closesAt ? <FieldProblems messages={problems.closesAt} /> : <Hint>{m.closesHint}</Hint>}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="durationMinutes">{m.timeLimit}</Label>
          <div className="flex items-center gap-2.5">
            <TextInput
              id="durationMinutes"
              type="number"
              lang="en"
              inputMode="numeric"
              min={1}
              max={180}
              invalid={!!problems.durationMinutes}
              className="w-[110px]"
              {...register('durationMinutes')}
            />
            <span className="text-[15px] text-ink-2">{m.minutesUnit}</span>
          </div>
          {problems.durationMinutes ? (
            <FieldProblems messages={problems.durationMinutes} />
          ) : (
            <Hint>{m.durationHint}</Hint>
          )}
        </div>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-small font-semibold">{m.negativeMarking}</legend>
        <Segmented
          label={m.negativeMarking}
          options={penaltyOptions(m)}
          value={penalty}
          onChange={(value) => setValue('penalty', value, { shouldDirty: true })}
          className="-me-1 sm:me-0 [&_button]:px-2 sm:[&_button]:px-3"
        />
        {penalty === 'custom' && (
          <div className="flex items-center gap-2.5 pt-1">
            <TextInput
              aria-label={m.customAria}
              type="number"
              lang="en"
              inputMode="numeric"
              min={0}
              max={100}
              compact
              invalid={!!problems.wrongAnswerPenaltyPercent}
              className="w-[96px]"
              {...register('customPenalty')}
            />
            <span className="text-[15px] text-ink-2">{m.customUnit}</span>
          </div>
        )}
        {problems.wrongAnswerPenaltyPercent ? <FieldProblems messages={problems.wrongAnswerPenaltyPercent} /> : <Hint>{markingHint(percent, m)}</Hint>}
      </fieldset>
    </section>
  )
}
