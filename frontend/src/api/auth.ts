import { isApiError, request } from './client'
import type { CurrentUser, LoginRequest } from './types'

export const login = (credentials: LoginRequest) =>
  request<CurrentUser>('POST', '/api/auth/login', { body: credentials, allowUnauthorized: true })

export const logout = () => request<void>('POST', '/api/auth/logout', { allowUnauthorized: true })

/** The signed-in user, or null when there is no session. */
export async function getCurrentUser(signal?: AbortSignal): Promise<CurrentUser | null> {
  try {
    return await request<CurrentUser>('GET', '/api/auth/me', { signal, allowUnauthorized: true })
  } catch (error) {
    if (isApiError(error) && error.status === 401) return null
    throw error
  }
}
