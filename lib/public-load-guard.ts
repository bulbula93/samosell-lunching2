import "server-only"

/** Per-instance protection for ONE cookie-free public loader. No result is cached.
 * Next's Data Cache remains responsible for TTLs and invalidation. Failures are
 * never converted into empty data or persisted. This is not a distributed lock.
 */
export function guardPublicLoad<T>(load: () => Promise<T>, failureCooldownMs = 30_000) {
  let inFlight: Promise<T> | null = null
  let retryAfter = 0

  return function guardedLoad(): Promise<T> {
    if (inFlight) return inFlight
    if (Date.now() < retryAfter) {
      return Promise.reject(new Error("public_loader_cooling_down"))
    }
    inFlight = Promise.resolve().then(load).catch((error: unknown) => {
      retryAfter = Date.now() + failureCooldownMs
      throw error
    }).finally(() => {
      inFlight = null
    })
    return inFlight
  }
}
