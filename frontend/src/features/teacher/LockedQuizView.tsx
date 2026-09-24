import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { listTeacherQuizzes, teacherKeys } from '../../api/teacher'
import type { QuizEditorView } from '../../api/types'
import { Num } from '../../components/Auto'
import { Badge } from '../../components/Badge'
import { ButtonLink } from '../../components/Button'
import { ClassChip } from '../../components/ClassChip'
import { Icon } from '../../components/Icon'
import { BackLink, PageShell } from '../../components/PageShell'
import { optionLabel } from '../../lib/dir'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatDateTimeWithYear } from '../../lib/time'

const OPEN_BY_DEFAULT = 3

/** A quiz with attempts: content frozen, shown read-only (prototype: "Locked quiz"). */
export function LockedQuizView({ view }: { view: QuizEditorView }) {
  const { t, lang } = useLanguage()
  const m = t.locked
  const summaries = useQuery({ queryKey: teacherKeys.quizzes(), queryFn: ({ signal }) => listTeacherQuizzes(signal) })
  const started = summaries.data?.find((q) => q.id === view.id)?.startedCount
  const resultsPath = `/teacher/quizzes/${view.id}/results`
  const questions = [...view.questions].sort((a, b) => a.order - b.order)

  return (
    <PageShell width="teacher" mainClassName="gap-6 pt-5 pb-10 md:pt-8 md:pb-12">
      <div className="flex flex-col gap-2.5">
        <BackLink to="/teacher" label={t.shell.myQuizzes} />
        <div className="flex gap-2">
          <Badge kind={view.state} />
          <Badge kind="Locked" />
        </div>
        <h1 dir="auto" className="auto-text text-page leading-[1.45] font-bold md:text-display">
          {view.title}
        </h1>
      </div>

      <div role="status" className="flex flex-col gap-3.5 rounded-sheet border border-strong bg-tint px-[18px] py-4 md:flex-row md:items-start">
        <div className="flex flex-1 items-start gap-3.5">
          <span className="flex size-10 flex-none items-center justify-center rounded-full bg-paper text-ink">
            <Icon name="lock" />
          </span>
          <div className="flex flex-1 flex-col gap-1">
            <div className="text-[17px] font-bold">{m.title}</div>
            <p className="text-[15px] leading-[1.55] text-ink-2">{m.body(started)}</p>
          </div>
        </div>
        <ButtonLink to={resultsPath} className="w-full md:w-auto">
          {m.viewResults}
        </ButtonLink>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-8">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-3.5 rounded-sheet border border-rule bg-paper p-5">
            <h2 className="text-card font-bold">{m.details}</h2>
            <dl className="flex flex-col">
              <Row label={m.classes}>
                <span className="flex flex-wrap gap-1.5">
                  {view.classRooms.map((c) => (
                    <ClassChip key={c.id} name={c.name} />
                  ))}
                </span>
              </Row>
              <Row label={t.teacher.opens}>{formatDateTimeWithYear(view.opensAt, lang)}</Row>
              <Row label={t.teacher.closes}>{formatDateTimeWithYear(view.closesAt, lang)}</Row>
              <Row label={m.timeLimit}>{m.minutes(view.durationMinutes)}</Row>
              <Row label={m.negativeMarking}>{t.teacher.markingLong(view.wrongAnswerPenaltyPercent)}</Row>
              <Row label={m.maxScore}>{m.points(view.maxScore)}</Row>
            </dl>
            {view.description && (
              <p dir="auto" className="auto-text border-t border-rule-soft pt-3 text-[15px] leading-[1.6] whitespace-pre-wrap text-ink-2">
                {view.description}
              </p>
            )}
          </section>

          <section className="flex flex-col rounded-sheet border border-rule bg-paper px-5 pt-5 pb-2">
            <div className="flex items-baseline justify-between pb-3">
              <h2 className="text-card font-bold">
                {m.questions}{' '}
                <span className="font-medium text-muted">
                  <Num>{questions.length}</Num>
                </span>
              </h2>
              <span className="text-small text-muted">{m.readOnly}</span>
            </div>
            <ReadOnlyQuestions questions={questions} />
          </section>
        </div>

        <aside className="lg:sticky lg:top-6">
          <section className="flex flex-col gap-3 rounded-sheet border border-rule bg-paper p-[18px]">
            <h2 className="text-body font-bold">{m.actions}</h2>
            <ButtonLink to={resultsPath} size="lg" className="w-full">
              {m.viewResults}
            </ButtonLink>
            <DisabledAction>{m.unpublish}</DisabledAction>
            <DisabledAction>{m.deleteQuiz}</DisabledAction>
            <p className="text-meta leading-normal text-muted">{m.actionsNote}</p>
          </section>
        </aside>
      </div>
    </PageShell>
  )
}

function ReadOnlyQuestions({ questions }: { questions: QuizEditorView['questions'] }) {
  const { t } = useLanguage()
  const m = t.locked
  const [open, setOpen] = useState<Set<string>>(() => new Set(questions.slice(0, OPEN_BY_DEFAULT).map((q) => q.id)))

  return (
    <div className="flex flex-col gap-2 pb-3">
      {questions.map((question, index) =>
        open.has(question.id) ? (
          <section key={question.id} className="flex flex-col gap-3 border-t border-rule-soft py-[18px]">
            <div className="flex justify-between text-small font-semibold text-ink-2">
              <span>{m.questionN(index + 1)}</span>
              <span>{m.points(question.points)}</span>
            </div>
            <p dir="auto" className="auto-text text-card leading-[1.6] font-semibold whitespace-pre-wrap">
              {question.text}
            </p>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {[...question.options]
                .sort((a, b) => a.order - b.order)
                .map((option, j) => (
                  <li
                    key={option.id}
                    dir="auto"
                    className={`flex items-center gap-3 rounded-option px-3 py-2.5 text-body ${
                      option.isCorrect ? 'border-2 border-green bg-green-bg' : 'border border-rule-soft bg-paper'
                    }`}
                  >
                    <span
                      className={`flex size-[26px] flex-none items-center justify-center rounded-full text-meta font-bold ${
                        option.isCorrect ? 'bg-green text-paper' : 'border-[1.5px] border-muted text-ink-2'
                      }`}
                    >
                      {optionLabel(j, question.text)}
                    </span>
                    <span className="flex-1">{option.text}</span>
                    {option.isCorrect && (
                      <span className="inline-flex flex-none items-center gap-1 text-meta font-bold text-green">
                        <Icon name="check" className="size-3.5" strokeWidth={2.2} />
                        {m.correct}
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          </section>
        ) : (
          <button
            key={question.id}
            type="button"
            aria-expanded={false}
            onClick={() => setOpen((current) => new Set([...current, question.id]))}
            className="flex min-h-[52px] w-full items-center gap-3 rounded-option border border-rule bg-paper px-3 py-2 text-start text-ink hover:bg-tint"
          >
            <span className="w-7 flex-none text-small font-bold text-ink-2">
              <Num>{index + 1}</Num>
            </span>
            <span dir="auto" className="min-w-0 flex-1 truncate text-[15px]">
              {question.text}
            </span>
            <span className="flex-none text-meta text-muted">
              {m.ptsShort(question.points)}
            </span>
            <Icon name="chevronRight" className="size-[18px] text-muted" />
          </button>
        ),
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-rule-soft py-[11px] first:border-t-0">
      <dt className="w-[120px] flex-none text-small text-muted md:w-[150px]">{label}</dt>
      <dd className="flex-1 text-[15px] leading-[1.45] text-ink">{children}</dd>
    </div>
  )
}

function DisabledAction({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      disabled
      className="flex min-h-11 w-full items-center justify-center rounded-control border border-rule-soft bg-rule-soft px-[18px] text-body font-semibold text-[#6B7690]"
    >
      {children}
    </button>
  )
}
