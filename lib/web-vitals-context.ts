/** Viewport buckets, independent of window height / on-screen keyboards. */
export function classifyViewport(width: number): "phone" | "tablet" | "desktop" {
  return width <= 767 ? "phone" : width <= 1024 ? "tablet" : "desktop"
}

/** Document metrics belong to the document navigation, not the current SPA route. */
export function getDocumentMetricContext(navigationUrl: string, fallbackUrl: string) {
  let url: URL
  try { url = new URL(navigationUrl || fallbackUrl) } catch { url = new URL(fallbackUrl) }
  const pathname = url.pathname
  const routeGroup = pathname === "/" ? "home" : pathname.startsWith("/listing/") ? "listing" : pathname === "/catalog" ? url.searchParams.get("q")?.trim() ? "search" : "catalog" : "other"
  return { pathname, routeGroup }
}
