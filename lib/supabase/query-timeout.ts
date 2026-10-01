export const PUBLIC_QUERY_TIMEOUT_MS = 7000

/** Cancel the underlying PostgREST request, including response body reads. */
export async function withQueryTimeout<T>(
  query: { abortSignal(signal: AbortSignal): PromiseLike<T> } | ((signal: AbortSignal) => PromiseLike<T>),
  timeoutMs = PUBLIC_QUERY_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await (typeof query === "function"
      ? query(controller.signal)
      : query.abortSignal(controller.signal))
  } finally {
    clearTimeout(timer)
  }
}
