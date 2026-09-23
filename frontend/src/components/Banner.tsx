import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export type BannerKind = 'error' | 'warn' | 'info' | 'success' | 'lock'

const styles: Record<BannerKind, { icon: IconName; className: string }> = {
  error: { icon: 'alert', className: 'bg-red-bg border-red-line text-red' },
  warn: { icon: 'clock', className: 'bg-amber-bg border-amber-line text-amber-ink' },
  info: { icon: 'info', className: 'bg-tint border-rule text-ink' },
  success: { icon: 'check', className: 'bg-green-bg border-green-line text-green' },
  lock: { icon: 'lock', className: 'bg-paper border-rule text-ink-2' },
}

type BannerProps = { kind: BannerKind; title?: ReactNode; children?: ReactNode; action?: ReactNode; className?: string }

/** Errors are announced immediately (role="alert"); everything else politely (role="status"). */
export function Banner({ kind, title, children, action, className = '' }: BannerProps) {
  const style = styles[kind]
  return (
    <div
      role={kind === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-option border px-4 py-3 ${style.className} ${className}`}
    >
      <Icon name={style.icon} className="mt-0.5 size-5" />
      <div className="min-w-0 flex-1 text-small">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
