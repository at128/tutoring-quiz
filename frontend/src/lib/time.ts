// Pure time helpers. The server owns time: the browser only displays it, using the offset from `serverNow`.

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Milliseconds to add to Date.now() to get the server's clock. */
export const serverOffset = (serverNowIso: string, clientNowMs = Date.now()) => Date.parse(serverNowIso) - clientNowMs

export const serverNowMs = (offsetMs: number, clientNowMs = Date.now()) => clientNowMs + offsetMs

/** Remaining time until `deadlineIso` by the server's clock, never below 0. */
export const remainingMs = (deadlineIso: string, offsetMs: number, clientNowMs = Date.now()) =>
  Math.max(0, Date.parse(deadlineIso) - serverNowMs(offsetMs, clientNowMs))

/** m:ss, or h:mm:ss from one hour up. */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

const dateTime = new Intl.DateTimeFormat('en-GB', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
})
const timeOnly = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })

/** "Thu 8 Oct, 10:00" in the viewer's local time. */
export const formatDateTime = (iso: string) => dateTime.format(new Date(iso))

/** "10:00" in the viewer's local time. */
export const formatTime = (iso: string) => timeOnly.format(new Date(iso))

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

/** "in 2 days", "in 3 hours", "in 12 minutes", "2 days ago" — relative to the server's now. */
export function formatRelative(iso: string, nowMs: number): string {
  const diff = Date.parse(iso) - nowMs
  const abs = Math.abs(diff)
  if (abs >= DAY) return relative.format(Math.round(diff / DAY), 'day')
  if (abs >= HOUR) return relative.format(Math.round(diff / HOUR), 'hour')
  return relative.format(Math.round(diff / MINUTE), 'minute')
}

/** "20 minutes", "1 minute", "1 h 30 min". */
export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}
