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
const styles: Record<BadgeKind, { icon: IconName; label: string; className: string }> = {
  InProgress: { icon: 'halfCircle', label: 'In progress', className: 'bg-tint border-strong text-ink' },
  Available: { icon: 'dot', label: 'Available', className: 'bg-green-bg border-green-line text-green' },
  Open: { icon: 'dot', label: 'Open', className: 'bg-green-bg border-green-line text-green' },
  Upcoming: { icon: 'clock', label: 'Upcoming', className: 'bg-desk border-rule text-ink-2' },
  Scheduled: { icon: 'calendar', label: 'Scheduled', className: 'bg-desk border-rule text-ink-2' },
  Completed: { icon: 'check', label: 'Completed', className: 'bg-paper border-ink text-ink' },
  Submitted: { icon: 'check', label: 'Submitted', className: 'bg-green-bg border-green-line text-green' },
  Expired: { icon: 'hourglass', label: 'Expired', className: 'bg-amber-bg border-amber-line text-amber-ink' },
  Missed: { icon: 'minusCircle', label: 'Missed', className: 'bg-paper border-dashed border-strong text-muted' },
  Draft: { icon: 'pencil', label: 'Draft', className: 'bg-paper border-dashed border-strong text-muted' },
  Closed: { icon: 'x', label: 'Closed', className: 'bg-rule-soft border-rule text-ink-2' },
  Locked: { icon: 'lock', label: 'Locked', className: 'bg-paper border-rule text-ink-2' },
  NotStarted: { icon: 'circle', label: 'Not started', className: 'bg-paper border-rule text-muted' },
}

export function Badge({ kind, className = '' }: { kind: BadgeKind; className?: string }) {
  const style = styles[kind]
  return (
    <span
      className={`inline-flex h-[26px] items-center gap-1.5 rounded-full border px-2.5 text-meta leading-none font-semibold whitespace-nowrap ${style.className} ${className}`}
    >
      <Icon name={style.icon} className="size-3.5" strokeWidth={2} />
      <span>{style.label}</span>
    </span>
  )
}
