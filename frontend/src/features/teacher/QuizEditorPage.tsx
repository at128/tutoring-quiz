import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { useLocation, useNavigate, useParams } from 'react-router'
import { isApiError } from '../../api/client'
import {
  createTeacherQuiz,
  deleteTeacherQuiz,
  getTeacherQuiz,
  listClassRooms,
  publishTeacherQuiz,
  teacherKeys,
  unpublishTeacherQuiz,
  updateTeacherQuiz,
} from '../../api/teacher'
import type { QuizEditorView } from '../../api/types'
import { Badge } from '../../components/Badge'
import { Banner } from '../../components/Banner'
import { Button } from '../../components/Button'
import { Dialog } from '../../components/Dialog'
import { Icon } from '../../components/Icon'
import { BackLink, PageShell } from '../../components/PageShell'
import { ErrorState, NotAvailableState, Skeleton } from '../../components/States'
import { useLanguage } from '../../i18n/LanguageContext'
import { DetailsSection, type ClassRoomsState } from './editor/DetailsSection'
import { DeleteButton, EditorAside, EditorFooter, ProblemsBanner, type EditorAction } from './editor/EditorAside'
import {
  emptyForm,
  fromView,
  localizeServerProblems,
  penaltyPercent,
  problemLines,
  toUpsert,
  validate,
  type EditorValues,
  type Intent,
  type Problems,
} from './editor/editorForm'
import { QuestionsSection } from './editor/QuestionsSection'
import { LockedQuizView } from './LockedQuizView'

const editPath = (id: string) => `/teacher/quizzes/${id}/edit`

type Notice =
  | { kind: 'saved' | 'published' | 'unpublished' }
  | { kind: 'locked' | 'hasAttempts' | 'failed'; message?: string }

type LocationState = { notice?: Notice; problems?: Problems } | null

/** /teacher/quizzes/new and /teacher/quizzes/:quizId/edit (prototype: "Edit quiz", "Locked quiz"). */
export function QuizEditorPage() {
  const { t } = useLanguage()
  const BACK = { to: '/teacher', label: t.shell.myQuizzes }
  const { quizId } = useParams()
  const quiz = useQuery({
    queryKey: teacherKeys.quiz(quizId ?? 'new'),
    queryFn: ({ signal }) => getTeacherQuiz(quizId!, signal),
    enabled: Boolean(quizId),
  })
  const classRooms = useQuery({ queryKey: teacherKeys.classRooms(), queryFn: ({ signal }) => listClassRooms(signal) })

  if (quizId && quiz.isPending)
    return (
      <PageShell width="teacher" mainClassName="gap-5 pt-5 pb-10 md:pt-8">
        <BackLink {...BACK} />
        <div className="flex flex-col gap-4 rounded-sheet border border-rule bg-paper p-5" aria-busy="true" aria-label={t.editor.loading}>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PageShell>
    )

  if (quizId && quiz.isError)
    return (
      <PageShell width="teacher" mainClassName="gap-5 pt-5 pb-10 md:pt-8">
        <BackLink {...BACK} />
        {isApiError(quiz.error, 'not_found') ? (
          <NotAvailableState title={t.editor.notFoundTitle} backTo="/teacher" backLabel={t.editor.backToMyQuizzes}>
            {t.editor.notFoundBody}
          </NotAvailableState>
        ) : (
          <ErrorState error={quiz.error} onRetry={() => void quiz.refetch()} title={t.editor.loadError} />
        )}
      </PageShell>
    )

  if (quiz.data?.isLocked) return <LockedQuizView view={quiz.data} />

  const classRoomsState: ClassRoomsState = {
    data: classRooms.data,
    failed: classRooms.isError,
    retry: () => void classRooms.refetch(),
  }
  return <QuizEditor key={quizId ?? 'new'} view={quiz.data ?? null} classRooms={classRoomsState} />
}

function QuizEditor({ view, classRooms }: { view: QuizEditorView | null; classRooms: ClassRoomsState }) {
  const { t } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const location = useLocation()
  const arrival = location.state as LocationState

  // When the editor opened: new-quiz defaults and live checks use it; saving re-checks with the current time.
  const [openedAt] = useState(() => Date.now())
  const form = useForm<EditorValues>({ defaultValues: view ? fromView(view) : emptyForm(openedAt) })
  // Subscribes to every field so problems and the status facts update as the teacher types.
  const values = useWatch({ control: form.control }) as EditorValues
  const [attempt, setAttempt] = useState<Intent | null>(arrival?.problems ? 'publish' : null)
  // The instant of the last Save/Publish: the problems shown are checked against the same time the save used.
  const [checkedAt, setCheckedAt] = useState(openedAt)
  const [serverProblems, setServerProblems] = useState<Problems>(arrival?.problems ?? {})
  const [notice, setNotice] = useState<Notice | null>(arrival?.notice ?? null)
  const [busy, setBusy] = useState<EditorAction | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Client rules re-run live after the first failed attempt; server messages stay until the next attempt.
  const clientProblems: Problems = attempt ? validate(values, attempt, checkedAt, t.editor) : {}
  const problems: Problems = { ...clientProblems, ...localizeServerProblems(serverProblems, clientProblems, t) }
  const lines = problemLines(problems, t.editor)
  const dirty = form.formState.isDirty

  // A notice carried over from creating the quiz is shown once, not again after a refresh.
  useEffect(() => {
    if (location.state) window.history.replaceState({ ...window.history.state, usr: null }, '')
  }, [location.state])

  async function reload() {
    if (!view) return
    const fresh = await queryClient.fetchQuery({ queryKey: teacherKeys.quiz(view.id), queryFn: () => getTeacherQuiz(view.id), staleTime: 0 })
    if (!fresh.isLocked) form.reset(fromView(fresh))
    setServerProblems({})
    setAttempt(null)
    setNotice(null)
  }

  // Only warn before leaving while there are unsaved edits.
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  function afterSave(saved: QuizEditorView) {
    queryClient.setQueryData(teacherKeys.quiz(saved.id), saved)
    void queryClient.invalidateQueries({ queryKey: teacherKeys.quizzes() })
    form.reset(fromView(saved))
  }

  function explain(error: unknown) {
    if (isApiError(error, 'validation_failed', 'quiz.invalid_for_publish')) {
      setServerProblems(error.errors)
      setNotice(null)
    } else if (isApiError(error, 'quiz.locked')) setNotice({ kind: 'locked' })
    else if (isApiError(error, 'quiz.has_attempts')) setNotice({ kind: 'hasAttempts', message: error.detail ?? undefined })
    else if (isApiError(error, 'not_found')) setNotice({ kind: 'failed', message: t.editor.gone })
    else
      setNotice({
        kind: 'failed',
        message: isApiError(error, 'network_error') ? t.errors.checkConnection : t.errors.tryLater,
      })
  }

  async function save(intent: Intent) {
    setAttempt(intent)
    setServerProblems({})
    setNotice(null)
    const current = form.getValues()
    const now = Date.now()
    setCheckedAt(now)
    if (Object.keys(validate(current, intent, now, t.editor)).length > 0) return

    setBusy(intent)
    try {
      if (!view) {
        const { id } = await createTeacherQuiz(toUpsert(current))
        void queryClient.invalidateQueries({ queryKey: teacherKeys.quizzes() })
        form.reset(current) // nothing unsaved any more, so leaving doesn't warn
        try {
          if (intent === 'publish') await publishTeacherQuiz(id)
          navigate(editPath(id), { replace: true, state: { notice: { kind: intent === 'publish' ? 'published' : 'saved' } } })
        } catch (error) {
          // Created as a draft but not publishable yet: continue on the saved draft with the reasons shown.
          const problemsFromServer = isApiError(error, 'quiz.invalid_for_publish', 'validation_failed') ? error.errors : undefined
          navigate(editPath(id), { replace: true, state: { problems: problemsFromServer, notice: problemsFromServer ? undefined : { kind: 'failed' } } })
        }
        return
      }

      let saved = await updateTeacherQuiz(view.id, toUpsert(current))
      afterSave(saved)
      if (intent === 'publish') {
        saved = await publishTeacherQuiz(view.id)
        afterSave(saved)
      }
      setAttempt(null)
      setNotice({ kind: intent === 'publish' ? 'published' : 'saved' })
    } catch (error) {
      explain(error)
    } finally {
      setBusy(null)
    }
  }

  async function unpublish() {
    if (!view) return
    setBusy('unpublish')
    setNotice(null)
    try {
      const saved = await unpublishTeacherQuiz(view.id)
      queryClient.setQueryData(teacherKeys.quiz(saved.id), saved)
      void queryClient.invalidateQueries({ queryKey: teacherKeys.quizzes() })
      setNotice({ kind: 'unpublished' })
    } catch (error) {
      explain(error)
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!view) return
    setBusy('delete')
    try {
      await deleteTeacherQuiz(view.id)
      form.reset(form.getValues())
      queryClient.removeQueries({ queryKey: teacherKeys.quiz(view.id) })
      await queryClient.invalidateQueries({ queryKey: teacherKeys.quizzes() })
      navigate('/teacher', { replace: true })
    } catch (error) {
      setConfirmDelete(false)
      explain(error)
      setBusy(null)
    }
  }

  function onAction(action: EditorAction) {
    if (action === 'save') void save('save')
    else if (action === 'publish') void save('publish')
    else if (action === 'unpublish') void unpublish()
    else setConfirmDelete(true)
  }

  const penalty = penaltyPercent(values)
  const facts = {
    questions: values.questions.length,
    points: values.questions.reduce((sum, q) => sum + (Number.parseInt(q.points, 10) || 0), 0),
    minutes: values.durationMinutes || '—',
    marking: penalty === null ? '—' : penalty === 0 ? t.editor.markingNone : `${penalty}%`,
  }

  return (
    <PageShell
      width="teacher"
      mainClassName="gap-5 pt-5 pb-8 md:gap-6 md:pt-8 md:pb-12"
      footer={<EditorFooter view={view} busy={busy} onAction={onAction} />}
      footerClassName="lg:hidden"
    >
      <div className="flex flex-col gap-2">
        <BackLink to="/teacher" label={t.shell.myQuizzes} />
        <div className="flex items-center justify-between gap-3 lg:justify-start">
          <h1 className="text-page leading-[1.3] font-bold md:text-display">{view ? t.editor.editTitle : t.editor.newTitle}</h1>
          {dirty ? (
            <span className="inline-flex items-center gap-1.5 text-small text-amber-ink">
              <Icon name="pencil" className="size-4" />
              {t.editor.unsaved}
            </span>
          ) : (
            <span className="lg:hidden">
              <Badge kind={view?.state ?? 'Draft'} />
            </span>
          )}
        </div>
      </div>

      <NoticeBanner notice={notice} view={view} onReload={() => void reload()} />
      {lines.length > 0 && (
        <div className="lg:hidden">
          <ProblemsBanner lines={lines} title={attempt === 'publish' ? t.editor.cantPublish : undefined} />
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-8">
        <form noValidate onSubmit={(event) => event.preventDefault()} className="flex min-w-0 flex-col gap-6">
          <DetailsSection form={form} classRooms={classRooms} problems={problems} />
          <QuestionsSection form={form} problems={problems} />
          {view && (
            <div className="lg:hidden">
              <DeleteButton busy={busy} onClick={() => setConfirmDelete(true)} />
            </div>
          )}
        </form>
        <EditorAside view={view} facts={facts} problemLines={lines} busy={busy} onAction={onAction} />
      </div>

      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} role="alertdialog" labelledBy="delete-title" dismissible={busy !== 'delete'}>
        <div className="flex flex-col gap-3.5">
          <h2 id="delete-title" className="text-[20px] font-bold">
            {t.editor.deleteTitle}
          </h2>
          <p className="text-[15px] leading-[1.55] text-ink-2">{t.editor.deleteBody}</p>
          <div className="flex flex-col gap-2.5 pt-1">
            <Button variant="danger" size="lg" loading={busy === 'delete'} onClick={() => void remove()}>
              {t.editor.deleteQuiz}
            </Button>
            <Button variant="secondary" size="lg" disabled={busy === 'delete'} onClick={() => setConfirmDelete(false)}>
              {t.editor.keepIt}
            </Button>
          </div>
        </div>
      </Dialog>
    </PageShell>
  )
}

function NoticeBanner({ notice, view, onReload }: { notice: Notice | null; view: QuizEditorView | null; onReload: () => void }) {
  const { t } = useLanguage()
  const m = t.editor
  if (!notice) return null
  switch (notice.kind) {
    case 'saved':
      return <Banner kind="success">{view?.isPublished ? m.changesSaved : m.draftSaved}</Banner>
    case 'published':
      return <Banner kind="success">{m.published}</Banner>
    case 'unpublished':
      return <Banner kind="info">{m.unpublished}</Banner>
    case 'locked':
    case 'hasAttempts':
      return (
        <div className="flex flex-col gap-3">
          <div role="alert" className="flex items-start gap-2.5 rounded-option border border-red-line bg-red-bg px-3.5 py-3">
            <span className="pt-px text-red">
              <Icon name="lock" strokeWidth={2} />
            </span>
            <div className="flex flex-1 flex-col gap-0.5">
              <div className="text-[15px] leading-[1.4] font-semibold text-red">
                {notice.kind === 'locked' ? m.lockedTitle : m.hasAttemptsTitle}
              </div>
              <div className="text-small leading-normal text-ink-2">
                {notice.kind === 'locked' ? m.lockedBody : m.hasAttemptsBody}
              </div>
            </div>
          </div>
          <Button size="lg" className="w-full md:w-auto md:self-start" onClick={onReload}>
            <Icon name="refresh" className="size-[18px]" />
            {m.reload}
          </Button>
        </div>
      )
    case 'failed':
      return <Banner kind="error" title={m.saveFailed}>{notice.message ?? t.errors.tryLater}</Banner>
  }
}
