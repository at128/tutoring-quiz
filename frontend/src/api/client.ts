import type { ErrorCode, ProblemDetails } from './types'

/** Client-only codes for failures that never reached the API. */
export type ClientErrorCode = 'network_error' | 'invalid_response' | 'http_error'

/** A failed API call. UI decisions use `code`, never the message text. */
export class ApiError extends Error {
  readonly status: number
  readonly code: ErrorCode | ClientErrorCode
  readonly title: string
  readonly detail: string | null
  readonly errors: Record<string, string[]>

  constructor(status: number, code: ErrorCode | ClientErrorCode, title: string, detail: string | null, errors: Record<string, string[]> = {}) {
    super(detail ?? title)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.title = title
    this.detail = detail
    this.errors = errors
  }
}

export const isApiError = (error: unknown, ...codes: (ErrorCode | ClientErrorCode)[]): error is ApiError =>
  error instanceof ApiError && (codes.length === 0 || codes.includes(error.code))

type UnauthorizedHandler = () => void
let onUnauthorized: UnauthorizedHandler = () => {}

/** The auth layer registers what "session expired" means (clear the user, go to /login?returnTo=…). */
export function setUnauthorizedHandler(handler: UnauthorizedHandler) {
  onUnauthorized = handler
}

type RequestOptions = {
  body?: unknown
  signal?: AbortSignal
  /** Login and the session probe expect 401 and handle it themselves. */
  allowUnauthorized?: boolean
}

export async function request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(method, path, options)

  if (!response.ok) {
    const error = await toApiError(response)
    if (error.status === 401 && !options.allowUnauthorized) onUnauthorized()
    throw error
  }

  if (response.status === 204) return undefined as T
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError(response.status, 'invalid_response', 'Unexpected response', 'The server sent something we could not read. Try again.')
  }
}

async function send(method: string, path: string, { body, signal }: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  try {
    return await fetch(path, {
      method,
      credentials: 'same-origin',
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'network_error', 'No connection', "Can't reach the server. Check your connection and try again.")
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  const problem = await readProblem(response)
  return new ApiError(
    response.status,
    (problem.code as ErrorCode | undefined) ?? 'http_error',
    problem.title ?? response.statusText ?? 'Request failed',
    problem.detail ?? null,
    problem.errors ?? {},
  )
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  try {
    const value: unknown = await response.json()
    return typeof value === 'object' && value !== null ? (value as ProblemDetails) : {}
  } catch {
    return {}
  }
}
