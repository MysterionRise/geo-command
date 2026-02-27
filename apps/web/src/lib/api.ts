export class ApiError extends Error {
  code: string
  requestId: string

  constructor(code: string, message: string, requestId: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.requestId = requestId
  }
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'

export async function api<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
): Promise<T> {
  const { token, ...fetchOptions } = options

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
  })

  const json = await res.json()

  if (!res.ok) {
    const error = json.error
    throw new ApiError(
      error?.code || 'UNKNOWN',
      error?.message || 'An error occurred',
      error?.requestId || 'unknown',
    )
  }

  return json.data as T
}
