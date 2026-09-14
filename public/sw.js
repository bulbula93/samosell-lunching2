const CACHE_NAME = "samosell-pwa-v2"
const STATIC_ASSETS = ["/icon.svg", "/pwa-icon-192.svg", "/pwa-icon-512.svg", "/apple-icon.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then(async (keys) => {
        const hadLegacyChunks = keys.includes("samosell-pwa-v1")
        await Promise.all(keys.filter((key) => key.startsWith("samosell-pwa-") && key !== CACHE_NAME).map((key) => caches.delete(key)))
        await self.clients.claim()
        // v1 cached unversioned Webpack dev chunks containing old Server Action IDs.
        // Replace already-loaded references too, once, without a manual cache reset.
        if (hadLegacyChunks) {
          const windows = await self.clients.matchAll({ type: "window" })
          await Promise.all(windows.map((client) => client.navigate(client.url).catch(() => null)))
        }
      }),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Next owns JS/CSS caching. Dev URLs are reused across compilations, whereas
  // Server Action IDs change; cache-first here can mix different compilations.
  const isStatic = STATIC_ASSETS.includes(url.pathname)
  if (!isStatic) return

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) return cached

      try {
        const response = await fetch(request)
        if (response.ok) {
          await cache.put(request, response.clone())
        }
        return response
      } catch {
        return new Response("Offline", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "content-type": "text/plain; charset=utf-8" },
        })
      }
    }),
  )
})

self.addEventListener("push", (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch {
    payload = { body: event.data ? event.data.text() : "" }
  }

  const title = typeof payload.title === "string" && payload.title ? payload.title : "SamoSell"
  const body = typeof payload.body === "string" ? payload.body : "ახალი შეტყობინება გაქვს"
  const url = typeof payload.url === "string" && payload.url.startsWith("/")
    ? payload.url
    : "/dashboard/notifications"
  const tag = typeof payload.tag === "string" ? payload.tag : undefined

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/apple-icon.png",
      badge: "/icon.svg",
      tag,
      renotify: Boolean(tag),
      data: { url },
    }),
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = new URL(event.notification.data?.url || "/dashboard/notifications", self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          await client.focus()
          if ("navigate" in client) await client.navigate(targetUrl)
          return
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(targetUrl)
    }),
  )
})
