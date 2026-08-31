const CACHE_NAME = "samosell-pwa-v1"
const STATIC_ASSETS = ["/icon.svg", "/apple-icon.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener("fetch", (event) => {
  const request = event.request
  if (request.method !== "GET") return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  const isStatic = url.pathname.startsWith("/_next/static/") || STATIC_ASSETS.includes(url.pathname)
  if (!isStatic) return

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => cached)
      return cached || network
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
