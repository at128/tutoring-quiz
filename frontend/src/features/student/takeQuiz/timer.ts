// Pure timer rules for the quiz header (docs/DESIGN_HANDOFF_FINAL.md → Timer).

export type TimerPhase = 'normal' | 'warn' | 'final' | 'zero'

const FIVE_MINUTES = 5 * 60_000
const ONE_MINUTE = 60_000

/** Normal above 5:00, amber at ≤ 5:00, red at ≤ 1:00, solid red at 0:00. */
export function timerPhase(remainingMs: number): TimerPhase {
  if (remainingMs <= 0) return 'zero'
  if (remainingMs <= ONE_MINUTE) return 'final'
  if (remainingMs <= FIVE_MINUTES) return 'warn'
  return 'normal'
}

export type TimeNotice = '5min' | '1min'

/** The one-off notice to show when the countdown crosses 5:00 or 1:00 between two ticks. */
export function crossedNotice(previousMs: number, currentMs: number): TimeNotice | null {
  if (previousMs > ONE_MINUTE && currentMs <= ONE_MINUTE && currentMs > 0) return '1min'
  if (previousMs > FIVE_MINUTES && currentMs <= FIVE_MINUTES && currentMs > ONE_MINUTE) return '5min'
  return null
}

export const noticeText: Record<TimeNotice, string> = {
  '5min': '5 minutes left',
  '1min': '1 minute left — answers still save as you tap',
}

/** Retry delays for a failed answer save: 1 s, 2 s, 4 s, then every 8 s. */
export const retryDelayMs = (failures: number) => Math.min(8000, 1000 * 2 ** Math.max(0, failures - 1))
