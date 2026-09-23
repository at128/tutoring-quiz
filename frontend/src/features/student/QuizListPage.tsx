import { useQuery } from '@tanstack/react-query'
import { listStudentQuizzes, studentKeys } from '../../api/student'
import { useSignedInUser } from '../../auth/useAuth'
import { Auto } from '../../components/Auto'
import { PageShell } from '../../components/PageShell'
import { Sheet } from '../../components/Sheet'
import { EmptyState, ErrorState, Skeleton } from '../../components/States'
import { serverOffset } from '../../lib/time'
import { useServerNow } from '../../lib/useServerNow'
import { QuizCard } from './parts/QuizCard'
import { groupByStatus, groupTitles } from './studentQuizCopy'

export function QuizListPage() {
  const user = useSignedInUser()
  const quizzes = useQuery({ queryKey: studentKeys.quizzes(), queryFn: ({ signal }) => listStudentQuizzes(signal) })
  const offset = quizzes.data ? serverOffset(quizzes.data.serverNow, quizzes.dataUpdatedAt) : 0
  const nowMs = useServerNow(offset)

  return (
    <PageShell>
      <h1 className="text-page font-bold">My quizzes</h1>
      <p className="mt-1 text-small text-ink-2">
        <Auto>{user.fullName}</Auto>
        {user.classRoom && ` · class ${user.classRoom.name}`}
      </p>

      <div className="mt-5">
        {quizzes.isPending ? (
          <ListSkeleton />
        ) : quizzes.isError ? (
          <ErrorState error={quizzes.error} onRetry={() => void quizzes.refetch()} title="Your quizzes didn't load" />
        ) : quizzes.data.quizzes.length === 0 ? (
          <EmptyState icon="calendar" title="No quizzes yet">
            When your teacher publishes a quiz for your class, it shows up here with its opening time.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-7">
            {groupByStatus(quizzes.data.quizzes).map((group) => (
              <section key={group.status} aria-labelledby={`group-${group.status}`}>
                <h2 id={`group-${group.status}`} className="mb-3 text-small font-semibold text-ink-2">
                  {groupTitles[group.status]} <span className="text-muted">({group.quizzes.length})</span>
                </h2>
                <div className="flex flex-col gap-3">
                  {group.quizzes.map((quiz) => (
                    <QuizCard key={quiz.id} quiz={quiz} nowMs={nowMs} />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </PageShell>
  )
}

function ListSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading your quizzes">
      {[0, 1, 2].map((i) => (
        <Sheet key={i} className="p-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="mt-3 h-6 w-3/4" />
          <Skeleton className="mt-3 h-14 w-full" />
          <Skeleton className="mt-3 h-11 w-full" />
        </Sheet>
      ))}
    </div>
  )
}
