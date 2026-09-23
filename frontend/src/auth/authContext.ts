import { createContext } from 'react'
import type { CurrentUser, LoginRequest } from '../api/types'

export const meKey = ['auth', 'me'] as const

export type AuthContextValue = {
  /** undefined while the session is being checked; null when signed out. */
  user: CurrentUser | null | undefined
  isChecking: boolean
  checkError: unknown
  retryCheck: () => void
  signIn: (credentials: LoginRequest) => Promise<CurrentUser>
  signOut: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)
