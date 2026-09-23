import { Logo } from '../components/Icon'
import { NotAvailableState } from '../components/States'

export function NotFoundPage() {
  return (
    <div className="min-h-dvh bg-desk">
      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-6 px-4 pt-12 pb-8">
        <div className="flex items-center gap-2.5 font-bold">
          <Logo />
          Weekly Quizzes
        </div>
        <NotAvailableState title="This page doesn’t exist" backTo="/" backLabel="Go to your quizzes">
          The link may be old or mistyped. Your quizzes are on the home page.
        </NotAvailableState>
      </main>
    </div>
  )
}
