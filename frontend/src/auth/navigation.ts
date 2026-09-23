import type { Role } from '../api/types'

export const roleHome = (role: Role) => (role === 'Teacher' ? '/teacher' : '/student')

/** Only same-site paths are allowed after login (no open redirects via ?returnTo=https://…). */
export function safeReturnTo(value: string | null): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return null
  return value.startsWith('/login') ? null : value
}

/** Where to go after signing in: the page the user wanted, if it belongs to their role; else their home. */
export function afterLoginPath(role: Role, returnTo: string | null): string {
  const target = safeReturnTo(returnTo)
  const home = roleHome(role)
  return target && (target === '/' || target.startsWith(home)) ? target : home
}

export const loginPath = (returnTo: string) =>
  returnTo === '/' ? '/login' : `/login?returnTo=${encodeURIComponent(returnTo)}`
