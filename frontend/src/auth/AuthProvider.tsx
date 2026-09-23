import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, type ReactNode } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import * as authApi from '../api/auth'
import { setUnauthorizedHandler } from '../api/client'
import type { LoginRequest } from '../api/types'
import { AuthContext, meKey, type AuthContextValue } from './authContext'
import { loginPath } from './navigation'

/** Knows who is signed in (GET /api/auth/me) and handles an expired session anywhere in the app. */
export function AuthProvider({ children }: { children?: ReactNode }) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()

  const me = useQuery({
    queryKey: meKey,
    queryFn: ({ signal }) => authApi.getCurrentUser(signal),
    staleTime: Infinity,
    retry: 1,
  })

  // Any 401 from the API: forget the user and everything cached for them, then ask them to sign in again.
  const currentPath = location.pathname + location.search
  useEffect(() => {
    setUnauthorizedHandler(() => {
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meKey[0] })
      queryClient.setQueryData(meKey, null)
      if (!currentPath.startsWith('/login')) navigate(loginPath(currentPath), { replace: true })
    })
    return () => setUnauthorizedHandler(() => {})
  }, [queryClient, navigate, currentPath])

  const signIn = useCallback(
    async (credentials: LoginRequest) => {
      const user = await authApi.login(credentials)
      queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== meKey[0] })
      queryClient.setQueryData(meKey, user)
      return user
    },
    [queryClient],
  )

  const signOut = useCallback(async () => {
    // Keep the session visible if the request fails: the server cookie may still be valid.
    await authApi.logout()
    queryClient.clear()
    queryClient.setQueryData(meKey, null)
    navigate('/login', { replace: true })
  }, [queryClient, navigate])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: me.data,
      isChecking: me.isPending,
      checkError: me.error,
      retryCheck: () => void me.refetch(),
      signIn,
      signOut,
    }),
    [me, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children ?? <Outlet />}</AuthContext.Provider>
}
