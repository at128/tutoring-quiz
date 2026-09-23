import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { Banner } from './Banner'
import { Icon, Logo } from './Icon'

type Width = 'student' | 'teacher'
const widths: Record<Width, string> = { student: 'max-w-[640px]', teacher: 'max-w-[1200px]' }

export type BackTarget = { to: string; label: string }

type PageShellProps = {
  width?: Width
  back?: BackTarget
  /** Pinned action bar (e.g. "Start quiz"); the content scrolls above it. */
  footer?: ReactNode
  /** Spacing of the content column (differs per screen in the design). */
  mainClassName?: string
  children: ReactNode
}

/** App bar, a centred column (640 for students, 1200 for teachers) on the desk background, optional footer. */
export function PageShell({ width = 'student', back, footer, mainClassName = 'gap-4 pt-4 pb-8', children }: PageShellProps) {
  const column = `mx-auto flex w-full flex-col px-4 ${widths[width]}`

  if (!footer)
    return (
      <div className="min-h-dvh bg-desk">
        <AppBar width={width} back={back} />
        <main className={`${column} ${mainClassName} pb-[max(2rem,env(safe-area-inset-bottom))]`}>{children}</main>
      </div>
    )

  return (
    <div className="flex h-dvh flex-col bg-desk">
      <AppBar width={width} back={back} />
      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className={`${column} ${mainClassName}`}>{children}</div>
      </main>
      <footer className="flex-none border-t border-rule bg-paper pb-[calc(12px+env(safe-area-inset-bottom))]">
        <div className={`${column} pt-3`}>{footer}</div>
      </footer>
    </div>
  )
}

function AppBar({ width, back }: { width: Width; back?: BackTarget }) {
  const { user, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)

  async function handleSignOut() {
    if (signingOut) return
    setSigningOut(true)
    setSignOutError(false)
    try {
      await signOut()
    } catch {
      setSigningOut(false)
      setSignOutError(true)
    }
  }

  return (
    <header className="flex-none border-b border-rule bg-paper pt-[env(safe-area-inset-top)]">
      <div className={`mx-auto flex h-[60px] w-full items-center justify-between gap-2 ps-4 pe-1.5 ${widths[width]}`}>
        <div className="flex min-w-0 items-center gap-4">
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
          {user?.role === 'Teacher' && !back && (
            <nav className="hidden sm:block">
              <NavLink
                to="/teacher"
                end
                className={({ isActive }) =>
                  `inline-flex min-h-11 items-center rounded-control px-3 text-small font-semibold ${isActive ? 'bg-tint text-ink' : 'text-ink-2 hover:bg-tint'}`
                }
              >
                My quizzes
              </NavLink>
            </nav>
          )}
        </div>

        {user && (
          <div className="flex min-w-0 items-center gap-0.5">
            <div className="flex min-w-0 flex-col items-end">
              <span dir="auto" className="max-w-[130px] truncate text-meta font-semibold text-ink sm:max-w-[240px]">
                {user.fullName}
              </span>
              <span className="text-[12px] text-muted">{user.classRoom ? `Class ${user.classRoom.name}` : 'Teacher'}</span>
            </div>
            <button
              type="button"
              aria-label="Sign out"
              title="Sign out"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              aria-busy={signingOut || undefined}
              className="inline-flex size-11 flex-none items-center justify-center rounded-control text-ink-2 hover:bg-tint disabled:opacity-60"
            >
              <Icon name="logout" />
            </button>
          </div>
        )}
      </div>
      {signOutError && (
        <div className={`mx-auto w-full px-4 pb-3 ${widths[width]}`}>
          <Banner kind="error">Sign out didn't work. You're still signed in. Check your connection and tap Sign out again.</Banner>
        </div>
      )}
    </header>
  )
}
