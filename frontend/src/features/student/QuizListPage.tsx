import { useQuery } from '@tanstack/react-query'
import { listStudentQuizzes, studentKeys } from '../../api/student'
import { useSignedInUser } from '../../auth/useAuth'
import { Num } from '../../components/Auto'
import { PageShell } from '../../components/PageShell'
import { EmptyState, ErrorState, Skeleton } from '../../components/States'
import { formatLongDate, serverOffset } from '../../lib/time'
import { useServerNow } from '../../lib/useServerNow'
import { QuizCard } from './parts/QuizCard'
import { groupByStatus, groupTitles } from './studentQuizCopy'

/** The student's home: quizzes grouped In progress → Available → Upcoming → Completed → Missed. */
export function QuizListPage() {
  const user = useSignedInUser()
  const quizzes = useQuery({ queryKey: studentKeys.quizzes(), queryFn: ({ signal }) => listStudentQuizzes(signal) })
  const offset = quizzes.data ? serverOffset(quizzes.data.serverNow, quizzes.dataUpdatedAt) : 0
  // Ticks every second while an attempt is running so its countdown stays live.
  const running = quizzes.data?.quizzes.some((q) => q.status === 'InProgress') ?? false
  const nowMs = useServerNow(offset, running ? 1000 : 30_000)
  const className = user.classRoom ? `Class ${user.classRoom.name}` : ''

  return (
    <PageShell mainClassName="gap-6 pt-5 pb-8">
      <div className="flex flex-col gap-0.5">
        <h1 className="text-page leading-[1.3] font-bold">Your quizzes</h1>
        <p className="text-small leading-normal text-muted">
          {formatLongDate(nowMs)}
          {className && ` · ${className}`}
        </p>
      </div>

      {quizzes.isPending ? (
        <ListSkeleton />
      ) : quizzes.isError ? (
        <ErrorState error={quizzes.error} onRetry={() => void quizzes.refetch()} title="Couldn’t load your quizzes" />
      ) : quizzes.data.quizzes.length === 0 ? (
        <EmptyState title="No quizzes yet">
          When a teacher publishes a quiz for {user.classRoom ? `class ${user.classRoom.name}` : 'your class'}, it appears here.
        </EmptyState>
      ) : (
        groupByStatus(quizzes.data.quizzes).map((group) => (
          <section key={group.status} aria-labelledby={`group-${group.status}`} className="flex flex-col gap-2.5">
            <h2 id={`group-${group.status}`} className="flex items-baseline gap-2 text-body font-bold">
              {groupTitles[group.status]}
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
  return (
    <div className="flex flex-col gap-4" aria-busy="true" aria-label="Loading your quizzes">
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
