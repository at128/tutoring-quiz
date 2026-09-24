import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCurrentUser } from './auth'
import { ApiError, isApiError, request, setUnauthorizedHandler } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
  setUnauthorizedHandler(() => {})
})

describe('API client', () => {
  it('sends same-origin cookies, JSON bodies, and the cancellation signal', async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ id: 'saved' }))
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()

    await expect(request<{ id: string }>('PUT', '/api/test', {
      body: { selectedOptionId: null }, signal: controller.signal,
    })).resolves.toEqual({ id: 'saved' })
    expect(fetchMock).toHaveBeenCalledWith('/api/test', {
      method: 'PUT', credentials: 'same-origin',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedOptionId: null }), signal: controller.signal,
    })
  })

  it('does not send a body or JSON content type for a bodyless request, and handles 204', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(request<void>('POST', '/api/logout')).resolves.toBeUndefined()
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      headers: { Accept: 'application/json' }, body: undefined,
    })
  })

  it('preserves problem codes and field errors, and notifies on an unauthorized session', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      code: 'auth.unauthenticated', title: 'Sign in', detail: 'Session expired',
      errors: { username: ['Required'] },
    }, { status: 401 })))

    await expect(request('GET', '/api/student/quizzes')).rejects.toMatchObject({
      status: 401, code: 'auth.unauthenticated', title: 'Sign in', detail: 'Session expired',
      errors: { username: ['Required'] },
    })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('does not clear the session for the expected 401 from the current-user probe', async () => {
    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({
      code: 'auth.unauthenticated', title: 'Not signed in',
    }, { status: 401 })))

    await expect(getCurrentUser()).resolves.toBeNull()
    expect(onUnauthorized).not.toHaveBeenCalled()
  })

  it('treats a non-401 current-user failure as an error, not as a signed-out session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ code: 'server_error' }, { status: 503 })))
    await expect(getCurrentUser()).rejects.toMatchObject({ status: 503, code: 'server_error' })
  })

  it('converts a network failure but lets intentional aborts pass through', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')))
    await expect(request('GET', '/api/test')).rejects.toMatchObject({ status: 0, code: 'network_error' })

    const abort = new DOMException('Aborted', 'AbortError')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort))
    await expect(request('GET', '/api/test')).rejects.toBe(abort)
  })

  it('reports malformed successful JSON and falls back when a problem body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 200 })))
    await expect(request('GET', '/api/test')).rejects.toMatchObject({ status: 200, code: 'invalid_response' })

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('not-json', { status: 502, statusText: 'Bad Gateway' })))
    await expect(request('GET', '/api/test')).rejects.toMatchObject({ status: 502, code: 'http_error', title: 'Bad Gateway' })
  })

  it('exposes an ApiError type guard keyed by code', () => {
    const error = new ApiError(409, 'quiz.closed', 'Closed', null)
    expect(isApiError(error, 'quiz.closed')).toBe(true)
    expect(isApiError(error, 'attempt.deadline_passed')).toBe(false)
    expect(isApiError(new Error('Closed'), 'quiz.closed')).toBe(false)
    expect(error.message).toBe('Closed')
  })
})
