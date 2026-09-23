import { PageShell } from '../../components/PageShell'
import { EmptyState } from '../../components/States'

// Placeholder until milestone F3 builds the teacher's quiz list.
export function TeacherQuizListPage() {
  return (
    <PageShell width="teacher">
      <h1 className="text-page font-bold">My quizzes</h1>
      <div className="mt-5">
        <EmptyState icon="pencil" title="Teacher pages are on their way">
          Creating quizzes and seeing results arrive in the next milestone.
        </EmptyState>
      </div>
    </PageShell>
  )
}
