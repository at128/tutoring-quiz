import { useQuery } from '@tanstack/react-query'
import { listStudentQuizzes, studentKeys } from '../../api/student'
import { useSignedInUser } from '../../auth/useAuth'
import { Num } from '../../components/Auto'
import { PageShell } from '../../components/PageShell'
import { EmptyState, ErrorState, Skeleton } from '../../components/States'
import { useLanguage } from '../../i18n/LanguageContext'
import { formatLongDate, serverOffset } from '../../lib/time'
import { useServerNow } from '../../lib/useServerNow'
import { liveQuizList } from './liveQuiz'
import { QuizCard } from './parts/QuizCard'
import { groupByStatus } from './studentQuizCopy'

/** The student's home: quizzes grouped In progress → Available → Upcoming → Completed → Missed. */
export function QuizListPage() {
  const { t, lang } = useLanguage()
  const user = useSignedInUser()
  const quizzes = useQuery({ queryKey: studentKeys.quizzes(), queryFn: ({ signal }) => listStudentQuizzes(signal) })
  const offset = quizzes.data ? serverOffset(quizzes.data.serverNow, quizzes.dataUpdatedAt) : 0
  // Keep opening/closing transitions and an active attempt's countdown current without a page refresh.
  const nowMs = useServerNow(offset, 1000)
  const currentQuizzes = quizzes.data ? liveQuizList(quizzes.data.quizzes, nowMs) : null
  const className = user.classRoom ? t.shell.className(user.classRoom.name) : ''

  return (
    <PageShell mainClassName="gap-6 pt-5 pb-8">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-page leading-[1.3] font-bold">{t.student.yourQuizzes}</h1>
        <p className="text-small leading-normal text-muted">
          {formatLongDate(nowMs, lang)}
          {className && ` · ${className}`}
        </p>
      </div>

      {quizzes.isPending ? (
        <ListSkeleton />
      ) : quizzes.isError ? (
        <ErrorState error={quizzes.error} onRetry={() => void quizzes.refetch()} title={t.student.listError} />
      ) : currentQuizzes?.length === 0 ? (
        <EmptyState title={t.student.emptyTitle}>{t.student.emptyBody(user.classRoom?.name ?? null)}</EmptyState>
      ) : (
        groupByStatus(currentQuizzes ?? []).map((group) => (
          <section key={group.status} aria-labelledby={`group-${group.status}`} className="flex flex-col gap-2.5">
            <h2 id={`group-${group.status}`} className="flex items-baseline gap-2 text-body font-bold">
              {t.student.groups[group.status]}
              <span className="text-small font-medium text-muted">
                <Num>{group.quizzes.length}</Num>
              </span>
            </h2>
            {group.quizzes.map((quiz) => (
              <QuizCard key={quiz.id} quiz={quiz} nowMs={nowMs} offsetMs={offset} />
            ))}
          </section>
        ))
      )}
    </PageShell>
  )
}

/** Ruled skeletons in the card shape (prototype: Loading). */
function ListSkeleton() {
  const t = useLanguage().t
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label={t.student.loadingList}>
      {[0, 1].map((i) => (
        <div key={i} className="flex flex-col gap-3 rounded-sheet border border-rule bg-paper p-4">
          <Skeleton className="h-6 w-[90px] rounded-full" />
          <Skeleton className="h-[18px] w-3/4" />
          <Skeleton className="h-[18px] w-3/5" />
          <div className="border-t border-rule-soft" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ))}
    </div>
  )
}
