import type { ReactNode } from 'react'
import { isApiError } from '../api/client'
import { Button } from './Button'
import { Icon, type IconName } from './Icon'

/** What will appear here, and when. */
export function EmptyState({ icon = 'info', title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-sheet border border-dashed border-strong bg-paper px-6 py-10 text-center">
      <Icon name={icon} className="size-7 text-muted" />
      <p className="text-card font-bold">{title}</p>
      {children && <div className="max-w-sm text-small text-ink-2">{children}</div>}
    </div>
  )
}

/** Says what happened and what to do; offers Try again. */
export function ErrorState({ error, onRetry, title = "This didn't load" }: { error: unknown; onRetry?: () => void; title?: string }) {
  const message = isApiError(error, 'network_error')
    ? "Can't reach the server. Check your connection, then try again."
    : isApiError(error) && error.detail
      ? error.detail
      : 'Something went wrong on our side. Try again in a moment.'

  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-sheet border border-red-line bg-paper px-6 py-10 text-center">
      <Icon name="alert" className="size-7 text-red" />
      <p className="text-card font-bold">{title}</p>
      <p className="max-w-sm text-small text-ink-2">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <Icon name="refresh" className="size-4" />
          Try again
        </Button>
      )}
    </div>
  )
}

/** Grey placeholder block in the final shape of what's loading. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-control bg-rule-soft ${className}`} />
}
