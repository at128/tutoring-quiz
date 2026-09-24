// Pure time helpers. The server owns time: the browser only displays it, using the offset from `serverNow`.
// Dates are written from fixed word lists (not Intl), so every browser shows the same words, in both languages.

import type { Lang } from '../i18n/lang'
import { arabicPlural } from '../i18n/plural'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** Milliseconds to add to Date.now() to get the server's clock. */
export const serverOffset = (serverNowIso: string, clientNowMs = Date.now()) => Date.parse(serverNowIso) - clientNowMs

export const serverNowMs = (offsetMs: number, clientNowMs = Date.now()) => clientNowMs + offsetMs

/** Remaining time until `deadlineIso` by the server's clock, never below 0. */
export const remainingMs = (deadlineIso: string, offsetMs: number, clientNowMs = Date.now()) =>
  Math.max(0, Date.parse(deadlineIso) - serverNowMs(offsetMs, clientNowMs))

/** m:ss, or h:mm:ss from one hour up (Western digits in both languages). */
export function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`
}

type Words = {
  weekdays: string[]
  months: string[]
  weekdaysLong: string[]
  monthsLong: string[]
  comma: string
  today: string
  tomorrow: string
}

// English: the design's abbreviations ("Sep", not "Sept"). Arabic: full names, as Arabic has no short forms.
const WORDS: Record<Lang, Words> = {
  en: {
    weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    weekdaysLong: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    monthsLong: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    comma: ',',
    today: 'Today',
    tomorrow: 'Tomorrow',
  },
  ar: {
    weekdays: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    months: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    weekdaysLong: ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'],
    monthsLong: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'],
    comma: '،',
    today: 'اليوم',
    tomorrow: 'غدًا',
  },
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** "Thu 8 Oct" / "الخميس 8 أكتوبر" in the viewer's local time. */
const shortDay = (date: Date, lang: Lang) => {
  const words = WORDS[lang]
  return `${words.weekdays[date.getDay()]} ${date.getDate()} ${words.months[date.getMonth()]}`
}

/** "10:00" (24-hour) in the viewer's local time. */
export function formatTime(iso: string): string {
  const date = new Date(iso)
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

/** "Thu 8 Oct, 10:00" / "الخميس 8 أكتوبر، 10:00". */
export const formatDateTime = (iso: string, lang: Lang) => `${shortDay(new Date(iso), lang)}${WORDS[lang].comma} ${formatTime(iso)}`

/** "Wed 23 Sep 2026, 10:00" (teacher details, where the year matters). */
export const formatDateTimeWithYear = (iso: string, lang: Lang) =>
  `${shortDay(new Date(iso), lang)} ${new Date(iso).getFullYear()}${WORDS[lang].comma} ${formatTime(iso)}`

const englishRelative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

type Unit = 'day' | 'hour' | 'minute'

// After "بعد" / "منذ" the dual is "يومين", "ساعتين", "دقيقتين"; one of a unit is just the unit.
const arabicUnits: Record<Unit, Parameters<typeof arabicPlural>[1]> = {
  day: { zero: 'يوم', one: 'يوم', two: 'يومين', few: (n) => `${n} أيام`, many: (n) => `${n} يومًا`, other: (n) => `${n} يوم` },
  hour: { zero: 'ساعة', one: 'ساعة', two: 'ساعتين', few: (n) => `${n} ساعات`, many: (n) => `${n} ساعة`, other: (n) => `${n} ساعة` },
  minute: {
    zero: 'دقيقة',
    one: 'دقيقة',
    two: 'دقيقتين',
    few: (n) => `${n} دقائق`,
    many: (n) => `${n} دقيقة`,
    other: (n) => `${n} دقيقة`,
  },
}

function arabicRelative(value: number, unit: Unit): string {
  if (value === 0) return 'الآن'
  if (unit === 'day' && value === 1) return 'غدًا'
  if (unit === 'day' && value === -1) return 'أمس'
  const amount = arabicPlural(Math.abs(value), arabicUnits[unit])
  return value > 0 ? `بعد ${amount}` : `منذ ${amount}`
}

/** "in 2 days" / "بعد يومين", "3 hours ago" / "منذ 3 ساعات": relative to the server's now. */
export function formatRelative(iso: string, nowMs: number, lang: Lang): string {
  const diff = Date.parse(iso) - nowMs
  const abs = Math.abs(diff)
  const [value, unit]: [number, Unit] =
    abs >= DAY ? [Math.round(diff / DAY), 'day'] : abs >= HOUR ? [Math.round(diff / HOUR), 'hour'] : [Math.round(diff / MINUTE), 'minute']
  return lang === 'ar' ? arabicRelative(value, unit) : englishRelative.format(value, unit)
}

const arabicMinutes = {
  zero: '0 دقيقة',
  one: 'دقيقة واحدة',
  two: 'دقيقتان',
  few: (n: number) => `${n} دقائق`,
  many: (n: number) => `${n} دقيقة`,
  other: (n: number) => `${n} دقيقة`,
}

/** "20 minutes", "1 minute", "1 h 30 min" / "20 دقيقة", "دقيقة واحدة", "1 س 30 د". */
export function formatMinutes(minutes: number, lang: Lang): string {
  if (minutes < 60)
    return lang === 'ar' ? arabicPlural(minutes, arabicMinutes) : `${minutes} minute${minutes === 1 ? '' : 's'}`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (lang === 'ar') return rest === 0 ? `${hours} س` : `${hours} س ${rest} د`
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`
}

/** "Thursday 24 September" / "الخميس 24 سبتمبر" (the list header). */
export function formatLongDate(ms: number, lang: Lang): string {
  const date = new Date(ms)
  const words = WORDS[lang]
  return `${words.weekdaysLong[date.getDay()]} ${date.getDate()} ${words.monthsLong[date.getMonth()]}`
}

/** "Fri 18 Sep" / "الجمعة 18 سبتمبر". */
export const formatShortDate = (iso: string, lang: Lang) => shortDay(new Date(iso), lang)

const localDayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`

/** "Today, 10:20" / "Tomorrow, 09:00" / a date: relative to the server's now, in local time. */
export function formatDayTime(iso: string, nowMs: number, lang: Lang): string {
  const target = new Date(iso)
  const words = WORDS[lang]
  if (localDayKey(target) === localDayKey(new Date(nowMs))) return `${words.today}${words.comma} ${formatTime(iso)}`
  if (localDayKey(target) === localDayKey(new Date(nowMs + DAY))) return `${words.tomorrow}${words.comma} ${formatTime(iso)}`
  return formatDateTime(iso, lang)
}
