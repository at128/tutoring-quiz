import { ButtonLink } from '../components/Button'
import { Mark } from '../components/PageShell'

export function NotFoundPage() {
  return (
    <div className="min-h-dvh bg-desk">
      <main className="mx-auto flex w-full max-w-[420px] flex-col items-center gap-3 px-4 py-16 text-center">
        <Mark />
        <h1 className="text-page font-bold">This page doesn't exist</h1>
        <p className="text-small text-ink-2">The link may be old or mistyped. Your quizzes are on the home page.</p>
        <ButtonLink to="/" variant="secondary" className="mt-2">
          Go to my quizzes
        </ButtonLink>
      </main>
    </div>
  )
}
