import type { ReactNode } from 'react'
import { isApiError } from '../api/client'
import { useT } from '../i18n/LanguageContext'
import { Button, ButtonLink } from './Button'
import { Icon, type IconName } from './Icon'

/** Dashed "paper" card with an icon, a title, what will happen, and an optional action (prototype: states). */
function StateCard({ icon, title, children, action }: { icon: IconName; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-sheet border border-dashed border-strong bg-paper px-5 py-8 text-center">
      <span className="flex size-[52px] items-center justify-center rounded-full bg-desk text-ink">
        <Icon name={icon} className="size-[26px]" />
      </span>
      <h2 className="text-card font-bold">{title}</h2>
      {children && <div className="text-[15px] leading-[1.55] text-ink-2">{children}</div>}
      {action}
    </div>
  )
}

/** What will appear here, and when. */
export function EmptyState({ icon = 'book', title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <StateCard icon={icon} title={title}>
      {children}
    </StateCard>
  )
}

/** Unknown, unpublished, other-class or not-owned: said plainly, with the way back. */
export function NotAvailableState({ title, children, backTo, backLabel }: { title: string; children?: ReactNode; backTo: string; backLabel: string }) {
  return (
    <StateCard icon="search" title={title} action={<ButtonLink to={backTo}>{backLabel}</ButtonLink>}>
      {children}
    </StateCard>
  )
}

/** Says what happened and what to do; offers Try again. */
export function ErrorState({ error, onRetry, title }: { error: unknown; onRetry?: () => void; title?: string }) {
  const t = useT()
  const message = isApiError(error, 'network_error')
    ? t.errors.checkConnection
    : t.errors.useServerDetail && isApiError(error) && error.detail
      ? error.detail
      : t.errors.serverProblem

  return (
    <div role="alert">
      <StateCard
        icon={isApiError(error, 'network_error') ? 'wifiOff' : 'alert'}
        title={title ?? t.errors.didNotLoad}
        action={
          onRetry && (
            <Button onClick={onRetry}>
              <Icon name="refresh" className="size-[18px]" />
              {t.errors.tryAgain}
            </Button>
          )
        }
      >
        {message}
      </StateCard>
    </div>
  )
}

/** Grey placeholder in the final shape of what's loading; the pulse stops under reduced motion. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-control bg-rule-soft ${className}`} />
}
