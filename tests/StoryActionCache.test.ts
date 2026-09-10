// @vitest-environment node
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import { describe, expect, it, vi } from "vitest"

// Execute the shipped worker, not a duplicate of its caching predicate.
function worker(keys = ["samosell-pwa-v1", "unrelated-cache"]) {
  const handlers: Record<string, (event: unknown) => void> = {}
  const oldChunk = new Response('createServerReference("obsolete-action-id")')
  const cache = { addAll: vi.fn().mockResolvedValue(undefined), put: vi.fn(), match: vi.fn().mockResolvedValue(oldChunk) }
  const caches = { open: vi.fn().mockResolvedValue(cache), keys: vi.fn().mockResolvedValue(keys), delete: vi.fn().mockResolvedValue(true), match: cache.match }
  const client = { url: "http://localhost:3000/", navigate: vi.fn().mockResolvedValue(undefined) }
  const clients = { claim: vi.fn().mockResolvedValue(undefined), matchAll: vi.fn().mockResolvedValue([client]) }
  const fetch = vi.fn().mockResolvedValue(new Response('createServerReference("current-action-id")'))
  runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: { addEventListener: (type: string, handler: (event: unknown) => void) => { handlers[type] = handler }, location: { origin: "http://localhost:3000" }, clients, skipWaiting: vi.fn() },
    caches, fetch, URL, Response,
  })
  return { handlers, caches, cache, client, clients, fetch }
}

describe("Story Server Action references across dev restarts", () => {
  it.each(["/_next/static/chunks/app/page.js", "/_next/static/chunks/webpack.js", "/_next/static/chunks/app/page.js?v=2"])("never serves a stale action reference from CacheStorage for %s", (path) => {
    const sw = worker()
    const respondWith = vi.fn()
    sw.handlers.fetch({ request: new Request(`http://localhost:3000${path}`), respondWith })
    expect(respondWith).not.toHaveBeenCalled()
    expect(sw.caches.match).not.toHaveBeenCalled()
  })

  it("removes the old application cache and automatically reloads its controlled pages once", async () => {
    const sw = worker()
    let activation: Promise<unknown> | undefined
    sw.handlers.activate({ waitUntil: (promise: Promise<unknown>) => { activation = promise } })
    await activation
    expect(sw.caches.delete).toHaveBeenCalledWith("samosell-pwa-v1")
    expect(sw.caches.delete).not.toHaveBeenCalledWith("unrelated-cache")
    expect(sw.clients.claim).toHaveBeenCalled()
    expect(sw.client.navigate).toHaveBeenCalledWith(sw.client.url)
  })

  it("does not reload pages on subsequent worker activations", async () => {
    const sw = worker(["samosell-pwa-v2", "unrelated-cache"])
    let activation: Promise<unknown> | undefined
    sw.handlers.activate({ waitUntil: (promise: Promise<unknown>) => { activation = promise } })
    await activation
    expect(sw.client.navigate).not.toHaveBeenCalled()
  })

  it("leaves action POSTs and private media outside the worker cache", () => {
    const sw = worker()
    for (const request of [new Request("http://localhost:3000/", { method: "POST" }), new Request("http://localhost:3000/api/stories/123/media")]) {
      const respondWith = vi.fn()
      sw.handlers.fetch({ request, respondWith })
      expect(respondWith).not.toHaveBeenCalled()
    }
  })
})
