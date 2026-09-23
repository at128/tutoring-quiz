import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { isApiError } from '../../api/client'
import { afterLoginPath } from '../../auth/navigation'
import { useAuth } from '../../auth/useAuth'
import { Button } from '../../components/Button'
import { Icon, Logo, type IconName } from '../../components/Icon'
import { PageSpinner } from '../../components/Spinner'

type FieldErrors = { username?: string; password?: string }
type FormError = { tone: 'error' | 'warn'; icon: IconName; title: string; detail: string }

/** Plain-language problem for a failed sign-in, chosen by error code (never says which field was wrong). */
function loginProblem(error: unknown): FormError {
  if (isApiError(error, 'auth.invalid_credentials'))
    return { tone: 'error', icon: 'alert', title: 'Username or password is incorrect.', detail: 'Check both and try again. Usernames look like 10a-07.' }
  if (isApiError(error, 'rate_limited'))
    return { tone: 'warn', icon: 'clock', title: 'Too many attempts.', detail: 'Wait a minute, then try again.' }
  if (isApiError(error, 'network_error'))
    return { tone: 'error', icon: 'wifiOff', title: 'Can’t reach the server.', detail: 'Check your connection and try again.' }
  return { tone: 'error', icon: 'alert', title: 'Signing in didn’t work.', detail: 'Try again in a moment.' }
}

function validate(username: string, password: string): FieldErrors {
  return {
    username: username.trim() ? undefined : 'Enter your username.',
    password: password ? undefined : 'Enter your password.',
  }
}

const RATE_LIMIT_WAIT_MS = 60_000

// Keep the focused field and Sign in visible above the phone keyboard.
const keepInView = (event: { currentTarget: HTMLElement }) =>
  event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })

/** Top-aligned sign-in (prototype: "Sign in" and "Sign in states"). */
export function LoginPage() {
  const { user, isChecking, signIn } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const returnTo = searchParams.get('returnTo')

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [problem, setProblem] = useState<FormError | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [waiting, setWaiting] = useState(false)

  // After 429 the button stays disabled for the rate-limit window; the fields keep their values.
  useEffect(() => {
    if (!waiting) return
    const timer = window.setTimeout(() => setWaiting(false), RATE_LIMIT_WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [waiting])

  if (isChecking) return <PageSpinner />
  if (user) return <Navigate to={afterLoginPath(user.role, returnTo)} replace />

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (submitting || waiting) return
    const errors = validate(username, password)
    setFieldErrors(errors)
    setProblem(null)
    if (errors.username || errors.password) return

    setSubmitting(true)
    try {
      const signedIn = await signIn({ username: username.trim(), password })
      navigate(afterLoginPath(signedIn.role, returnTo), { replace: true })
    } catch (error) {
      if (isApiError(error, 'validation_failed')) {
        setFieldErrors({ username: error.errors.username?.[0], password: error.errors.password?.[0] })
      } else {
        setProblem(loginProblem(error))
        if (isApiError(error, 'rate_limited')) setWaiting(true)
      }
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-dvh bg-desk">
      <main className="mx-auto flex w-full max-w-[420px] flex-col gap-7 px-4 pt-[calc(48px+env(safe-area-inset-top))] pb-6">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div className="flex flex-col">
            <span className="text-[20px] font-bold">Weekly Quizzes</span>
            <span className="text-small text-muted">Tutoring centre · Amman</span>
          </div>
        </div>

        <section className="flex flex-col gap-4 rounded-sheet border border-rule bg-paper p-5">
          <h1 className="text-page leading-[1.3] font-bold">Sign in</h1>
          <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-4">
            {problem && <ProblemBanner problem={problem} />}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="username" className="text-small font-semibold">
                Username
              </label>
              <input
                id="username"
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
                aria-describedby="username-hint"
                className={`h-12 w-full rounded-control bg-paper px-3.5 font-mono text-body text-ink ${fieldErrors.username ? 'border-2 border-red' : 'border border-strong'}`}
              />
              <div id="username-hint" className={`text-meta leading-[1.45] ${fieldErrors.username ? 'text-red' : 'text-muted'}`}>
                {fieldErrors.username ?? 'The username on your card from the centre, e.g. 10a-07.'}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="password" className="text-small font-semibold">
                Password
              </label>
              <div
                className={`flex h-12 items-center rounded-control bg-paper ps-3.5 focus-within:outline-3 focus-within:outline-offset-2 focus-within:outline-focus ${fieldErrors.password ? 'border-2 border-red' : 'border border-strong'}`}
              >
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={keepInView}
                  autoComplete="current-password"
                  aria-invalid={fieldErrors.password ? true : undefined}
                  aria-describedby={fieldErrors.password ? 'password-error' : undefined}
                  className="h-11 min-w-0 flex-1 border-0 bg-transparent text-body text-ink outline-none focus-visible:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  aria-pressed={showPassword}
                  aria-controls="password"
                  className="min-h-11 px-3 text-small font-semibold text-ink"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {fieldErrors.password && (
                <div id="password-error" className="text-meta text-red">
                  {fieldErrors.password}
                </div>
              )}
            </div>

            {waiting ? (
              <button
                type="button"
                disabled
                className="flex min-h-12 w-full items-center justify-center rounded-control border border-rule-soft bg-rule-soft px-[18px] text-body leading-[1.2] font-semibold text-[#6B7690]"
              >
                Sign in
              </button>
            ) : (
              <Button type="submit" size="lg" loading={submitting} className="w-full">
                Sign in
              </Button>
            )}
          </form>
        </section>

        <p className="text-center text-small leading-normal text-muted">Forgot your password? Ask your teacher or the centre office.</p>
      </main>
    </div>
  )
}

function ProblemBanner({ problem }: { problem: FormError }) {
  const error = problem.tone === 'error'
  return (
    <div
      role="alert"
      className={`flex items-start gap-2.5 rounded-option border px-3.5 py-3 ${error ? 'border-red-line bg-red-bg' : 'border-amber-line bg-amber-bg'}`}
    >
      <span className={`pt-px ${error ? 'text-red' : 'text-amber-ink'}`}>
        <Icon name={problem.icon} strokeWidth={2} />
      </span>
      <div className="flex flex-1 flex-col gap-0.5">
        <div className={`text-[15px] leading-[1.4] font-semibold ${error ? 'text-red' : 'text-amber-ink'}`}>{problem.title}</div>
        <div className="text-small leading-normal text-ink-2">{problem.detail}</div>
      </div>
    </div>
  )
}
