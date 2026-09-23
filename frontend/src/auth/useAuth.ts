import { useContext } from 'react'
import { AuthContext, type AuthContextValue } from './authContext'

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>.')
  return context
}

/** The signed-in user on a page already guarded by <RequireRole>. */
export function useSignedInUser() {
  const { user } = useAuth()
  if (!user) throw new Error('useSignedInUser must be used on a page guarded by <RequireRole>.')
  return user
}
