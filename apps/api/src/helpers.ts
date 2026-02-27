export function success<T>(data: T) {
  return { data }
}

export function apiError(code: string, message: string, requestId: string) {
  return {
    error: {
      code,
      message,
      requestId,
    },
  }
}
