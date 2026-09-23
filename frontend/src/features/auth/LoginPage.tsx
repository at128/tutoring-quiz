import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { isApiError } from '../../api/client'
import { afterLoginPath } from '../../auth/navigation'
import { useAuth } from '../../auth/useAuth'
import { Banner } from '../../components/Banner'
import { Button } from '../../components/Button'
import { Mark } from '../../components/PageShell'
import { PageSpinner } from '../../components/Spinner'

type FieldErrors = { username?: string; password?: string }

/** Plain-language message for a failed sign-in, chosen by error code. */
function loginErrorMessage(error: unknown): string {
  if (isApiError(error, 'auth.invalid_credentials')) return 'The username or password is wrong. Check both and try again.'
  if (isApiError(error, 'rate_limited')) return 'Too many sign-in attempts. Wait a minute, then try again.'
  if (isApiError(error, 'network_error')) return "Can't reach the server. Check your connection and try again."
  return 'Signing in failed on our side. Try again in a moment.'
}

function validate(username: string, password: string): FieldErrors {
  return {
    username: username.trim() ? undefined : 'Enter your username.',
    password: password ? undefined : 'Enter your password.',
  }
}

// Keep the focused field visible above the phone keyboard.
const keepInView = (event: { currentTarget: HTMLElement }) =>
  event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })

export function LoginPage() {
  const { user, isChecking, signIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (isChecking) return <PageSpinner />
  if (user) return <Navigate to={afterLoginPath(user.role, returnTo)} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const errors = validate(username, password)
    setFieldErrors(errors)
    setFormError(null)
    if (errors.username || errors.password) return

    setSubmitting(true)
    try {
      const signedIn = await signIn({ username: username.trim(), password })
      navigate(afterLoginPath(signedIn.role, returnTo), { replace: true })
    } catch (error) {
      if (isApiError(error, 'validation_failed')) {
        setFieldErrors({ username: error.errors.username?.[0], password: error.errors.password?.[0] })
      } else {
        setFormError(loginErrorMessage(error))
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh bg-desk">
      <main className="mx-auto w-full max-w-[420px] px-4 pt-[calc(2.5rem+env(safe-area-inset-top))] pb-10">
        <div className="mb-6 flex items-center gap-3">
          <Mark />
          <div>
            <h1 className="text-page font-bold">Weekly Quizzes</h1>
            <p className="text-small text-ink-2">Tutoring centre · Amman</p>
          </div>
        </div>

        <form noValidate onSubmit={handleSubmit} className="rounded-sheet border border-rule bg-paper p-5">
          <h2 className="text-card font-bold">Sign in</h2>
          <p className="mt-1 text-small text-ink-2">Use the username and password from your centre.</p>

          {formError && (
            <Banner kind="error" className="mt-4">
              {formError}
            </Banner>
          )}

          <label className="mt-5 block">
            <span className="text-small font-semibold">Username</span>
            <input
              name="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={keepInView}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              dir="auto"
              aria-invalid={fieldErrors.username ? true : undefined}
              aria-describedby={fieldErrors.username ? 'username-error' : undefined}
              className={`mt-1.5 block h-12 w-full rounded-control border bg-paper px-3 text-body ${fieldErrors.username ? 'border-2 border-red' : 'border-strong'}`}
            />
            {fieldErrors.username && (
              <span id="username-error" className="mt-1 block text-small text-red">
                {fieldErrors.username}
              </span>
            )}
          </label>

          <label className="mt-4 block">
            <span className="text-small font-semibold">Password</span>
            <input
              name="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={keepInView}
              autoComplete="current-password"
              aria-invalid={fieldErrors.password ? true : undefined}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
              className={`mt-1.5 block h-12 w-full rounded-control border bg-paper px-3 text-body ${fieldErrors.password ? 'border-2 border-red' : 'border-strong'}`}
            />
            {fieldErrors.password && (
              <span id="password-error" className="mt-1 block text-small text-red">
                {fieldErrors.password}
              </span>
            )}
          </label>

          <Button type="submit" size="lg" loading={submitting} className="mt-6 w-full">
            Sign in
          </Button>
        </form>
      </main>
    </div>
  )
}
