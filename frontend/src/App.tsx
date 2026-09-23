import { useEffect, useState } from 'react'

type HealthState = 'checking' | 'ok' | 'down'

// M0 placeholder: proves the SPA is served and can reach the API on the same origin.
export default function App() {
  const [health, setHealth] = useState<HealthState>('checking')

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/health', { credentials: 'same-origin', signal: controller.signal })
      .then(async (response) => {
        const body = (await response.json()) as { status?: string }
        setHealth(response.ok && body.status === 'ok' ? 'ok' : 'down')
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === 'AbortError')) setHealth('down')
      })
    return () => controller.abort()
  }, [])

  return (
    <main className="mx-auto max-w-xl px-4 py-10">
      <h1 className="text-2xl font-bold">Weekly Quizzes</h1>
      <p className="mt-2 text-base">
        API status:{' '}
        <span data-testid="health">
          {health === 'checking' ? 'checking…' : health === 'ok' ? 'ok' : 'unreachable'}
        </span>
      </p>
    </main>
  )
}
