import { Navigate, Outlet, useLocation } from 'react-router'
import type { Role } from '../api/types'
import { PageSpinner } from '../components/Spinner'
import { ErrorState } from '../components/States'
import { useT } from '../i18n/LanguageContext'
import { loginPath, roleHome } from './navigation'
import { useAuth } from './useAuth'

/** Signed out → login (coming back here afterwards); signed in with another role → that role's home. */
export function RequireRole({ role }: { role: Role }) {
  const t = useT()
  const { user, isChecking, checkError, retryCheck } = useAuth()
  const location = useLocation()

  if (isChecking) return <PageSpinner label={t.app.checkingSession} />
  if (checkError && user === undefined) return <SessionCheckError error={checkError} onRetry={retryCheck} />
  if (!user) return <Navigate to={loginPath(location.pathname + location.search)} replace />
  if (user.role !== role) return <Navigate to={roleHome(user.role)} replace />
  return <Outlet />
}

/** "/" → the signed-in user's home, or the login page. */
export function RoleRedirect() {
  const { user, isChecking, checkError, retryCheck } = useAuth()
  if (isChecking) return <PageSpinner />
  if (checkError && user === undefined) return <SessionCheckError error={checkError} onRetry={retryCheck} />
  return <Navigate to={user ? roleHome(user.role) : '/login'} replace />
}

function SessionCheckError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const t = useT()
  return (
    <div className="mx-auto max-w-[640px] px-4 py-10">
      <ErrorState error={error} onRetry={onRetry} title={t.app.sessionCheckFailed} />
    </div>
  )
}
