import type { ReactNode } from 'react'
import type { QuizEditorView } from '../../../api/types'
import { Num } from '../../../components/Auto'
import { Badge } from '../../../components/Badge'
import { Button } from '../../../components/Button'
import { Icon } from '../../../components/Icon'
import { plural } from '../../../lib/format'
import { statusSentence } from './editorForm'

export type EditorAction = 'save' | 'publish' | 'unpublish' | 'delete'

type Facts = { questions: number; points: number; minutes: string; marking: string }

type AsideProps = {
  view: QuizEditorView | null
  facts: Facts
  problemLines: string[]
  busy: EditorAction | null
  onAction: (action: EditorAction) => void
}

/** ≥ lg: sticky status + actions next to the form (prototype: Edit quiz → Status). */
export function EditorAside({ view, facts, problemLines, busy, onAction }: AsideProps) {
  const published = view?.isPublished ?? false
  return (
    <aside className="sticky top-6 hidden lg:block">
      <section className="flex flex-col gap-3.5 rounded-sheet border border-rule bg-paper p-[18px]">
        <div className="flex items-center justify-between">
          <h2 className="text-body font-bold">Status</h2>
          <Badge kind={view?.state ?? 'Draft'} />
        </div>
        <p className="text-small leading-[1.55] text-ink-2">{statusSentence(view)}</p>
        <dl className="flex flex-col">
          <FactRow label="Questions">
            <Num>{facts.questions}</Num>
          </FactRow>
          <FactRow label="Max score">
            <Num>{plural(facts.points, 'point')}</Num>
          </FactRow>
          <FactRow label="Time limit">
            <Num>{facts.minutes}</Num> min
          </FactRow>
          <FactRow label="Marking">{facts.marking}</FactRow>
        </dl>

        {problemLines.length > 0 && <ProblemsBanner lines={problemLines} />}

        {published ? (
          <>
            <Button size="lg" className="w-full" loading={busy === 'save'} disabled={busy !== null} onClick={() => onAction('save')}>
              Save changes
            </Button>
            <Button variant="secondary" className="w-full" loading={busy === 'unpublish'} disabled={busy !== null} onClick={() => onAction('unpublish')}>
              Unpublish
            </Button>
          </>
        ) : (
          <>
            <Button size="lg" className="w-full" loading={busy === 'publish'} disabled={busy !== null} onClick={() => onAction('publish')}>
              Publish
            </Button>
            <Button variant="secondary" className="w-full" loading={busy === 'save'} disabled={busy !== null} onClick={() => onAction('save')}>
              Save draft
            </Button>
          </>
        )}
        {view && (
          <DeleteButton busy={busy} onClick={() => onAction('delete')} />
        )}

        <p className="flex gap-2 text-meta leading-normal text-muted">
          <Icon name="lock" className="mt-0.5 size-4" />
          <span>When the first student starts, this quiz locks: questions, marking, time limit and classes can’t change after that.</span>
        </p>
      </section>
    </aside>
  )
}

export function DeleteButton({ busy, onClick }: { busy: EditorAction | null; onClick: () => void }) {
  return (
    <Button
      variant="secondary"
      className="w-full border-red-line! text-red hover:bg-red-bg"
      loading={busy === 'delete'}
      disabled={busy !== null}
      onClick={onClick}
    >
      <Icon name="trash" className="size-[18px]" />
      Delete quiz
    </Button>
  )
}

export function ProblemsBanner({ lines, title }: { lines: string[]; title?: string }) {
  const heading = title ?? (lines.length === 1 ? '1 problem to fix' : `${lines.length} problems to fix`)
  return (
    <div role="alert" className="flex items-start gap-2.5 rounded-option border border-red-line bg-red-bg px-3.5 py-3">
      <span className="pt-px text-red">
        <Icon name="alert" strokeWidth={2} />
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="text-[15px] leading-[1.4] font-semibold text-red">{heading}</div>
        {lines.slice(0, 4).map((line) => (
          <div key={line} className="text-small leading-normal text-ink-2">
            {line}
          </div>
        ))}
        {lines.length > 4 && <div className="text-small text-ink-2">…and {lines.length - 4} more.</div>}
      </div>
    </div>
  )
}

function FactRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 border-t border-rule-soft py-[11px] first:border-t-0">
      <dt className="w-[90px] flex-none text-small text-muted">{label}</dt>
      <dd className="flex-1 text-[15px] leading-[1.45] text-ink">{children}</dd>
    </div>
  )
}

/** < lg: the same actions pinned to the bottom (prototype: Edit quiz, mobile). */
export function EditorFooter({ view, busy, onAction }: { view: QuizEditorView | null; busy: EditorAction | null; onAction: (action: EditorAction) => void }) {
  const published = view?.isPublished ?? false
  return (
    <div className="flex gap-2.5">
      <div className="flex-1">
        {published ? (
          <Button variant="secondary" size="lg" className="w-full" loading={busy === 'unpublish'} disabled={busy !== null} onClick={() => onAction('unpublish')}>
            Unpublish
          </Button>
        ) : (
          <Button variant="secondary" size="lg" className="w-full" loading={busy === 'save'} disabled={busy !== null} onClick={() => onAction('save')}>
            Save draft
          </Button>
        )}
      </div>
      <div className="flex-1">
        {published ? (
          <Button size="lg" className="w-full" loading={busy === 'save'} disabled={busy !== null} onClick={() => onAction('save')}>
            Save changes
          </Button>
        ) : (
          <Button size="lg" className="w-full" loading={busy === 'publish'} disabled={busy !== null} onClick={() => onAction('publish')}>
            Publish
          </Button>
        )}
      </div>
    </div>
  )
}
