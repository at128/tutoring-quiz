import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { Banner } from './Banner'
import { Icon, Logo } from './Icon'

type Width = 'student' | 'teacher'
const widths: Record<Width, string> = {
  student: 'max-w-[640px] px-4',
  teacher: 'max-w-[1280px] px-4 md:px-10',
}

export type BackTarget = { to: string; label: string }

type PageShellProps = {
  width?: Width
  /** Student screens put the way back in the app bar; teacher screens use <BackLink> in the content. */
  back?: BackTarget
  /** Pinned action bar (e.g. "Start quiz"); the content scrolls above it. */
  footer?: ReactNode
  /** e.g. 'lg:hidden' when the actions move into an aside on wide screens. */
  footerClassName?: string
  /** Spacing of the content column (differs per screen in the design). */
  mainClassName?: string
  children: ReactNode
}

/** App bar, a centred column (640 for students, 1200 for teachers) on the desk background, optional footer. */
export function PageShell({ width = 'student', back, footer, footerClassName = '', mainClassName = 'gap-4 pt-4 pb-8', children }: PageShellProps) {
  const column = `mx-auto flex w-full flex-col ${widths[width]}`
  const bar = width === 'teacher' ? <TeacherBar /> : <StudentBar back={back} />

  if (!footer)
    return (
      <div className="min-h-dvh bg-desk">
        {bar}
        <main className={`${column} ${mainClassName} pb-[max(2rem,env(safe-area-inset-bottom))]`}>{children}</main>
      </div>
    )

  return (
    <div className="flex h-dvh flex-col bg-desk">
      {bar}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={`${column} ${mainClassName}`}>{children}</div>
      </main>
      <footer className={`flex-none border-t border-rule bg-paper pb-[calc(12px+env(safe-area-inset-bottom))] ${footerClassName}`}>
        <div className={`${column} pt-3`}>{footer}</div>
      </footer>
    </div>
  )
}

/** "‹ My quizzes" at the top of a teacher page. */
export function BackLink({ to, label }: BackTarget) {
  return (
    <Link
      to={to}
      className="-ms-1 inline-flex min-h-11 items-center gap-1 self-start rounded-control ps-1 pe-2.5 text-[15px] font-semibold text-ink hover:bg-tint"
    >
      <Icon name="chevronLeft" className="size-[18px]" />
      {label}
    </Link>
  )
}

function useSignOut() {
  const { signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [failed, setFailed] = useState(false)

  async function run() {
    if (signingOut) return
    setSigningOut(true)
    setFailed(false)
    try {
      await signOut()
    } catch {
      setSigningOut(false)
      setFailed(true)
    }
  }

  return { run, signingOut, failed }
}

function SignOutError({ width }: { width: Width }) {
  return (
    <div className={`mx-auto w-full pb-3 ${widths[width]}`}>
      <Banner kind="error">Sign out didn't work. You're still signed in. Check your connection and tap Sign out again.</Banner>
    </div>
  )
}

function SignOutIconButton({ onClick, busy }: { onClick: () => void; busy: boolean }) {
  return (
    <button
      type="button"
      aria-label="Sign out"
      title="Sign out"
      onClick={onClick}
      disabled={busy}
      aria-busy={busy || undefined}
      className="inline-flex size-11 flex-none items-center justify-center rounded-control text-ink-2 hover:bg-tint disabled:opacity-60"
    >
      <Icon name="logout" />
    </button>
  )
}

function StudentBar({ back }: { back?: BackTarget }) {
  const { user } = useAuth()
  const signOut = useSignOut()

  return (
    <header className="flex-none border-b border-rule bg-paper pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-[60px] w-full max-w-[640px] items-center justify-between gap-2 ps-4 pe-1.5">
        {back ? (
          <Link
            to={back.to}
            className="-ms-1.5 inline-flex min-h-11 items-center gap-1 rounded-control ps-1 pe-2 text-[15px] font-semibold text-ink hover:bg-tint"
          >
            <Icon name="chevronLeft" className="size-[18px]" />
            {back.label}
          </Link>
        ) : (
          <Link to="/" className="inline-flex items-center gap-2.5 text-body font-bold text-ink">
            <Logo />
            Weekly Quizzes
          </Link>
        )}

        {user && (
          <div className="flex min-w-0 items-center gap-0.5">
            <div className="flex min-w-0 flex-col items-end">
              <span dir="auto" className="max-w-[130px] truncate text-meta font-semibold text-ink sm:max-w-[240px]">
                {user.fullName}
              </span>
              {user.classRoom && <span className="text-[12px] text-muted">Class {user.classRoom.name}</span>}
            </div>
            <SignOutIconButton onClick={() => void signOut.run()} busy={signOut.signingOut} />
          </div>
        )}
      </div>
      {signOut.failed && <SignOutError width="student" />}
    </header>
  )
}

function TeacherBar() {
  const { user } = useAuth()
  const signOut = useSignOut()

  return (
    <header className="flex-none border-b border-rule bg-paper pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-[60px] w-full max-w-[1280px] items-center justify-between gap-2 ps-4 pe-1.5 md:h-16 md:px-10">
        <div className="flex items-center gap-7">
          <Link to="/teacher" className="flex items-center gap-2.5 text-ink">
            <Logo />
            <span className="text-body font-bold md:text-[17px]">Weekly Quizzes</span>
            <span className="hidden rounded-full border border-rule px-2 py-0.5 text-meta text-muted md:inline">Teacher</span>
          </Link>
          <nav aria-label="Main" className="hidden md:block">
            <NavLink
              to="/teacher"
              className={({ isActive }) =>
                `inline-flex min-h-11 items-center border-b-2 text-[15px] font-semibold text-ink ${isActive ? 'border-ink' : 'border-transparent hover:border-rule'}`
              }
            >
              My quizzes
            </NavLink>
          </nav>
        </div>

        {user && (
          <div className="flex min-w-0 items-center gap-0.5 md:gap-2">
            <span dir="auto" className="max-w-[130px] truncate text-meta font-semibold md:max-w-[260px] md:text-small">
              {user.fullName}
            </span>
            <span className="md:hidden">
              <SignOutIconButton onClick={() => void signOut.run()} busy={signOut.signingOut} />
            </span>
            <button
              type="button"
              onClick={() => void signOut.run()}
              disabled={signOut.signingOut}
              className="hidden min-h-11 items-center gap-2 rounded-control px-[18px] text-body font-semibold text-ink hover:bg-tint disabled:opacity-60 md:inline-flex"
            >
              <Icon name="logout" className="size-[18px]" />
              Sign out
            </button>
          </div>
        )}
      </div>
      {signOut.failed && <SignOutError width="teacher" />}
    </header>
  )
}
