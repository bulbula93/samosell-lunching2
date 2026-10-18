export const PUBLIC_QUERY_TIMEOUT_MS = 15000

export class QueryTimeoutError extends Error {
  readonly code = "query_timeout"

  constructor(readonly timeoutMs: number) {
    super(`Public query exceeded ${timeoutMs}ms`)
    this.name = "TimeoutError"
  }
}

/** Abort the transport AND stop waiting even when a transport ignores cancellation. */
export async function withQueryTimeout<T>(
  query: { abortSignal(signal: AbortSignal): PromiseLike<T> } | ((signal: AbortSignal) => PromiseLike<T>),
  timeoutMs = PUBLIC_QUERY_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  const startedAt = Date.now()
  const timeoutError = new QueryTimeoutError(timeoutMs)
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(timeoutError)
        controller.abort()
      }, timeoutMs)
    })
    const request = Promise.resolve().then(() => typeof query === "function"
      ? query(controller.signal)
      : query.abortSignal(controller.signal)).then((value) => {
      // A suspended function/event loop can resume with the response callback
      // ahead of its timer. Do not accept that late response as within budget.
      if (Date.now() - startedAt >= timeoutMs) {
        controller.abort()
        throw timeoutError
      }
      return value
    })
    return await Promise.race([request, deadline])
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}

/** Keep read-only catalog failures in the existing explicit retry UI, not a 500. */
export async function withQueryTimeoutResult<T>(
  query: Parameters<typeof withQueryTimeout<T>>[0],
  timeoutMs = PUBLIC_QUERY_TIMEOUT_MS,
) {
  try {
    return await withQueryTimeout(query, timeoutMs)
  } catch (error) {
    if (!(error instanceof QueryTimeoutError)) throw error
    return {
      data: null,
      count: null,
      error: { code: error.code, message: "Public data temporarily unavailable", details: "", hint: "" },
      status: 504,
      statusText: "Gateway Timeout",
    }
  }
}
