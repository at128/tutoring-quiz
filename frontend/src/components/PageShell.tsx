import { useState, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import { useAuth } from '../auth/useAuth'
import { Auto } from './Auto'
import { Banner } from './Banner'
import { IconButton } from './Button'
import { Icon } from './Icon'

type Width = 'student' | 'teacher'
const widths: Record<Width, string> = { student: 'max-w-[640px]', teacher: 'max-w-[1200px]' }

export type BackTarget = { to: string; label: string }

/** Desk background, app bar, and a centred column (640 for students, 1200 for teachers). */
export function PageShell({ width = 'student', back, children }: { width?: Width; back?: BackTarget; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-desk">
      <AppBar width={width} back={back} />
      <main className={`mx-auto w-full ${widths[width]} px-4 pt-5 pb-[calc(2.5rem+env(safe-area-inset-bottom))] md:px-10`}>
        {children}
      </main>
    </div>
  )
}

export function Mark() {
  return (
    <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-full border-2 border-ink">
      <span className="size-3.5 rounded-full bg-ink" />
    </span>
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
    <header className="border-b border-rule bg-paper pt-[env(safe-area-inset-top)]">
      <div className={`mx-auto flex min-h-14 w-full ${widths[width]} items-center gap-3 px-4 md:px-10`}>
        {back ? (
          <Link to={back.to} className="-ms-2 inline-flex min-h-11 items-center gap-1 rounded-control pe-2 font-semibold text-ink hover:bg-tint">
            <Icon name="chevronLeft" />
            {back.label}
          </Link>
        ) : (
          <Link to="/" className="inline-flex min-h-11 items-center gap-2 font-bold text-ink">
            <Mark />
            <span>Weekly Quizzes</span>
          </Link>
        )}

        {user?.role === 'Teacher' && !back && (
          <nav className="ms-4 hidden sm:block">
            <NavLink
              to="/teacher"
              end
              className={({ isActive }) =>
                `inline-flex min-h-11 items-center rounded-control px-3 font-semibold ${isActive ? 'bg-tint text-ink' : 'text-ink-2 hover:bg-tint'}`
              }
            >
              My quizzes
            </NavLink>
          </nav>
        )}

        {user && (
          <div className="ms-auto flex min-w-0 items-center gap-1">
            <div className="min-w-0 text-end leading-tight">
              <Auto className="block truncate text-small font-semibold">{user.fullName}</Auto>
              <span className="block truncate font-mono text-meta text-muted">
                {user.classRoom ? `${user.classRoom.name} · ${user.username}` : user.username}
              </span>
            </div>
            <IconButton label="Sign out" onClick={() => void handleSignOut()} disabled={signingOut} aria-busy={signingOut}>
              <Icon name="logout" />
            </IconButton>
          </div>
        )}
      </div>
      {signOutError && (
        <div className={`mx-auto w-full ${widths[width]} px-4 pb-3 md:px-10`}>
          <Banner kind="error">Sign out didn't work. You're still signed in. Check your connection and tap Sign out again.</Banner>
        </div>
      )}
    </header>
  )
}
