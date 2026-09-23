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

// Fixed English abbreviations: browsers disagree ("Sep" vs "Sept"), the design uses these.
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const pad2 = (n: number) => String(n).padStart(2, '0')

/** "Thu 8 Oct" in the viewer's local time. */
const shortDay = (date: Date) => `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`

/** "10:00" (24-hour) in the viewer's local time. */
export function formatTime(iso: string): string {
  const date = new Date(iso)
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** "Thu 8 Oct, 10:00" in the viewer's local time. */
export const formatDateTime = (iso: string) => `${shortDay(new Date(iso))}, ${formatTime(iso)}`

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

const longDate = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

/** "Thursday 24 September" (the list header). */
export const formatLongDate = (ms: number) => longDate.format(new Date(ms))

/** "Fri 18 Sep". */
export const formatShortDate = (iso: string) => shortDay(new Date(iso))

const localDayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

/** "Today, 10:20" / "Tomorrow, 09:00" / "Thu 8 Oct, 10:00", relative to the server's now, in local time. */
export function formatDayTime(iso: string, nowMs: number): string {
  const target = new Date(iso)
  const today = new Date(nowMs)
  const tomorrow = new Date(nowMs + DAY)
  if (localDayKey(target) === localDayKey(today)) return `Today, ${formatTime(iso)}`
  if (localDayKey(target) === localDayKey(tomorrow)) return `Tomorrow, ${formatTime(iso)}`
  return formatDateTime(iso)
}
