import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { isApiError } from '../../api/client'
import { getAttempt, studentKeys, submitAttempt } from '../../api/student'
import type { AttemptView } from '../../api/types'
import { ButtonLink } from '../../components/Button'
import { EmptyState, ErrorState, Skeleton } from '../../components/States'
import { serverOffset } from '../../lib/time'
import { answersReducer, fromServer, hasFailures, isAnswered } from './takeQuiz/answers'
import { QuestionCard } from './takeQuiz/QuestionCard'
import { ConnectionBanner, QuestionNavigator, QuizFooter, SubmitDialog, TimeNoticeBanner, TimeUpDialog } from './takeQuiz/QuizControls'
import { QuizHeader } from './takeQuiz/QuizHeader'
import { retryDelayMs } from './takeQuiz/timer'
import { useAutosave } from './takeQuiz/useAutosave'
import { useCountdown } from './takeQuiz/useCountdown'

type TimedAttempt = { view: AttemptView; receivedAt: number }

/** Server time is estimated at the middle of the request, so network delay can't shift the clock by much. */
async function fetchAttemptTimed(attemptId: string, signal?: AbortSignal): Promise<TimedAttempt> {
  const sentAt = Date.now()
  const view = await getAttempt(attemptId, signal)
  return { view, receivedAt: (sentAt + Date.now()) / 2 }
}

const resultPath = (attemptId: string) => `/student/attempts/${attemptId}/result`

export function TakeQuizPage() {
  const { attemptId = '' } = useParams()
  const attempt = useQuery({
    queryKey: studentKeys.attempt(attemptId),
    queryFn: ({ signal }) => fetchAttemptTimed(attemptId, signal),
    staleTime: Infinity,
    gcTime: 0,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  if (attempt.isPending) return <TakeQuizSkeleton />
  if (attempt.isError)
    return (
      <div className="mx-auto min-h-dvh max-w-[640px] px-4 py-10">
        {isApiError(attempt.error, 'not_found') ? (
          <EmptyState title="This quiz attempt isn't available">
            It may belong to another account. Your quizzes are on the home page.
            <div className="mt-4">
              <ButtonLink to="/student" variant="secondary">
                Go to my quizzes
              </ButtonLink>
            </div>
          </EmptyState>
        ) : (
          <ErrorState error={attempt.error} onRetry={() => void attempt.refetch()} title="Your quiz didn't load" />
        )}
      </div>
    )
  if (attempt.data.view.status !== 'InProgress') return <Navigate to={resultPath(attemptId)} replace />

  return <QuizRunner key={attemptId} initial={attempt.data} />
}

function QuizRunner({ initial }: { initial: TimedAttempt }) {
  const { view } = initial
  const attemptId = view.id
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const questionIds = view.questions.map((q) => q.id)

  const [clock, setClock] = useState(() => ({
    offset: serverOffset(view.serverNow, initial.receivedAt),
    deadline: view.deadline,
  }))
  const [answers, dispatch] = useReducer(answersReducer, view.questions, fromServer)
  const [index, setIndex] = useState(() => restoreIndex(attemptId, view.questions.length))
  const [phase, setPhase] = useState<'answering' | 'submitting'>('answering')
  const [dialog, setDialog] = useState<'none' | 'navigator' | 'confirm'>('none')
  const [stillTrying, setStillTrying] = useState(false)
  const mainRef = useRef<HTMLElement>(null)

  const { remaining, notice } = useCountdown(clock.deadline, clock.offset)
  const timeUp = remaining <= 0

  // ---- Finishing: one submit, retried while offline; the server decides Submitted vs Expired. ----
  const finishing = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const finish = useCallback(async () => {
    if (finishing.current) return
    finishing.current = true
    for (let failures = 1; mounted.current; failures++) {
      try {
        const result = await submitAttempt(attemptId)
        queryClient.setQueryData(studentKeys.result(attemptId), result)
        void queryClient.invalidateQueries({ queryKey: studentKeys.quizzes() })
        if (mounted.current) navigate(resultPath(attemptId), { replace: true })
        return
      } catch (error) {
        const transient = isApiError(error, 'network_error') || (isApiError(error) && error.status >= 500)
        if (isApiError(error) && error.status === 401) return // the auth layer takes over
        if (!transient) {
          if (mounted.current) navigate(resultPath(attemptId), { replace: true })
          return
        }
        setStillTrying(true)
        await new Promise((resolve) => window.setTimeout(resolve, retryDelayMs(failures)))
      }
    }
  }, [attemptId, navigate, queryClient])

  const autosave = useAutosave({ attemptId, answers, dispatch, active: !timeUp, onAttemptClosed: () => void finish() })

  // At 0:00 answers close, pending saves stop (autosave is inactive) and the saved answers are submitted.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- finish() only sets state after awaiting the network
    if (timeUp) void finish()
  }, [timeUp, finish])

  // "Submit quiz" confirmed: wait until every chosen answer is saved (while time remains), then submit.
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- finish() only sets state after awaiting the network
    if (phase === 'submitting' && autosave.pendingCount === 0 && !timeUp) void finish()
  }, [phase, autosave.pendingCount, timeUp, finish])

  // Back from a locked phone or another tab: resync the clock and answers from the server.
  useEffect(() => {
    async function resync() {
      if (document.visibilityState !== 'visible' || finishing.current) return
      try {
        const fresh = await fetchAttemptTimed(attemptId)
        if (!mounted.current || finishing.current) return
        if (fresh.view.status !== 'InProgress') {
          finishing.current = true
          navigate(resultPath(attemptId), { replace: true })
          return
        }
        setClock({ offset: serverOffset(fresh.view.serverNow, fresh.receivedAt), deadline: fresh.view.deadline })
        dispatch({ type: 'sync', questions: fresh.view.questions })
      } catch {
        // Offline: keep the local projection; saves and the next resync will catch up.
      }
    }
    document.addEventListener('visibilitychange', resync)
    window.addEventListener('pageshow', resync)
    return () => {
      document.removeEventListener('visibilitychange', resync)
      window.removeEventListener('pageshow', resync)
    }
  }, [attemptId, navigate])

  // Only warn before leaving while an answer hasn't reached the server yet.
  const hasUnsent = autosave.pendingCount > 0 && !timeUp
  useEffect(() => {
    if (!hasUnsent) return
    const warn = (event: BeforeUnloadEvent) => event.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [hasUnsent])

  const goTo = (next: number) => {
    const clamped = Math.min(Math.max(next, 0), questionIds.length - 1)
    setIndex(clamped)
    rememberIndex(attemptId, clamped)
    setDialog('none')
    mainRef.current?.scrollTo({ top: 0 })
  }

  const question = view.questions[index]
  const locked = timeUp || phase === 'submitting'
  const unanswered = questionIds.flatMap((id, i) => (isAnswered(answers[id]) ? [] : [i + 1]))

  return (
    <div className="flex h-dvh flex-col bg-desk">
      <QuizHeader
        title={view.quizTitle}
        remainingMs={remaining}
        questionIds={questionIds}
        currentIndex={index}
        answers={answers}
        notice={notice}
        onOpenNavigator={() => setDialog('navigator')}
      />

      <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-[640px] flex-col gap-3 px-3 pt-3 pb-4">
          {hasFailures(answers) && !timeUp && <ConnectionBanner pendingCount={autosave.pendingCount} onRetry={autosave.retryNow} />}
          {notice && !timeUp && <TimeNoticeBanner notice={notice} />}
          <QuestionCard
            question={question}
            number={index + 1}
            total={questionIds.length}
            answer={answers[question.id]}
            disabled={locked}
            closed={timeUp}
            onChoose={(optionId) => dispatch({ type: 'choose', questionId: question.id, optionId })}
            onRetry={autosave.retryNow}
          />
        </div>
      </main>

      <QuizFooter
        isFirst={index === 0}
        isLast={index === questionIds.length - 1}
        locked={locked}
        onPrevious={() => goTo(index - 1)}
        onNext={() => goTo(index + 1)}
        onSubmit={() => setDialog('confirm')}
      />

      <QuestionNavigator
        open={dialog === 'navigator' && !timeUp}
        questionIds={questionIds}
        currentIndex={index}
        answers={answers}
        locked={locked}
        onClose={() => setDialog('none')}
        onGoTo={goTo}
        onSubmit={() => setDialog('confirm')}
      />

      <SubmitDialog
        open={dialog === 'confirm' && !timeUp}
        unanswered={unanswered}
        penaltyPercent={view.wrongAnswerPenaltyPercent}
        pendingCount={autosave.pendingCount}
        submitting={phase === 'submitting'}
        // Until the submit request goes out (answers still being sent) the student may change their mind.
        canCancel={phase === 'answering' || autosave.pendingCount > 0}
        onCancel={() => {
          setPhase('answering')
          setDialog('none')
        }}
        onConfirm={() => setPhase('submitting')}
      />

      {timeUp && <TimeUpDialog resultHref={resultPath(attemptId)} stillTrying={stillTrying} />}
    </div>
  )
}

function TakeQuizSkeleton() {
  return (
    <div className="flex h-dvh flex-col bg-desk" aria-busy="true" aria-label="Loading your quiz">
      <div className="flex-none border-b border-rule bg-paper">
        <div className="mx-auto flex max-w-[640px] flex-col gap-2 px-4 pt-2.5 pb-3">
          <Skeleton className="h-4 w-2/3" />
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-5 flex-1" />
            <Skeleton className="h-11 w-28" />
          </div>
          <Skeleton className="h-2 w-full" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[640px] flex-1 px-3 pt-3">
        <div className="flex flex-col gap-3.5 rounded-sheet border border-rule bg-paper p-4">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-7 w-5/6" />
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  )
}

// The current question survives a refresh in this tab.
const indexKey = (attemptId: string) => `tq.question.${attemptId}`

function restoreIndex(attemptId: string, count: number): number {
  try {
    const saved = Number(window.sessionStorage.getItem(indexKey(attemptId)))
    return Number.isInteger(saved) && saved >= 0 && saved < count ? saved : 0
  } catch {
    return 0
  }
}

function rememberIndex(attemptId: string, index: number) {
  try {
    window.sessionStorage.setItem(indexKey(attemptId), String(index))
  } catch {
    // Private mode or storage disabled: the position just isn't remembered.
  }
}
