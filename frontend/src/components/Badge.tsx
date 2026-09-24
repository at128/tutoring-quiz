import { useT } from '../i18n/LanguageContext'
import { Icon, type IconName } from './Icon'

export type BadgeKind =
  | 'InProgress'
  | 'Available'
  | 'Open'
  | 'Upcoming'
  | 'Scheduled'
  | 'Completed'
  | 'Submitted'
  | 'Expired'
  | 'Missed'
  | 'Draft'
  | 'Closed'
  | 'Locked'
  | 'NotStarted'

// Mapping from docs/DESIGN_HANDOFF_FINAL.md and the prototype: always icon + word, never colour alone.
const styles: Record<BadgeKind, { icon: IconName; className: string }> = {
  InProgress: { icon: 'halfCircle', className: 'bg-tint border-strong text-ink' },
  Available: { icon: 'dot', className: 'bg-green-bg border-green-line text-green' },
  Open: { icon: 'dot', className: 'bg-green-bg border-green-line text-green' },
  Upcoming: { icon: 'clock', className: 'bg-desk border-rule text-ink-2' },
  Scheduled: { icon: 'calendar', className: 'bg-desk border-rule text-ink-2' },
  Completed: { icon: 'check', className: 'bg-paper border-ink text-ink' },
  Submitted: { icon: 'check', className: 'bg-green-bg border-green-line text-green' },
  Expired: { icon: 'hourglass', className: 'bg-amber-bg border-amber-line text-amber-ink' },
  Missed: { icon: 'minusCircle', className: 'bg-paper border-dashed border-strong text-muted' },
  Draft: { icon: 'pencil', className: 'bg-paper border-dashed border-strong text-muted' },
  Closed: { icon: 'x', className: 'bg-rule-soft border-rule text-ink-2' },
  Locked: { icon: 'lock', className: 'bg-paper border-rule text-ink-2' },
  NotStarted: { icon: 'circle', className: 'bg-paper border-rule text-muted' },
}

export function Badge({ kind, className = '' }: { kind: BadgeKind; className?: string }) {
  const t = useT()
  const style = styles[kind]
  return (
    <span
      className={`inline-flex h-[26px] items-center gap-1.5 rounded-full border px-2.5 text-meta leading-none font-semibold whitespace-nowrap ${style.className} ${className}`}
    >
      <Icon name={style.icon} className="size-3.5" strokeWidth={2} />
      <span>{t.badge[kind]}</span>
    </span>
  )
}
