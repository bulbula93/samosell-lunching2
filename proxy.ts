import { isReadOnlyPreview } from "@/lib/preview-read-only"
import { NextResponse, type NextRequest } from "next/server"
import { updateSession } from "@/lib/supabase/proxy"
import { categoryFromCatalogPath, getCatalogRedirectPath } from "@/lib/catalog-urls"

export async function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl
  // This production-backed preview permits only public page reads.
  // Block API, cron, callbacks, server actions and authenticated routes, even when GET.
  if (isReadOnlyPreview()) {
    const publicPage = pathname === "/" || pathname === "/catalog" ||
      pathname.startsWith("/catalog/") || pathname.startsWith("/listing/") ||
      pathname === "/listing-not-found" || pathname === "/catalog-not-found"
    if (!publicPage || !["GET", "HEAD"].includes(request.method)) {
      return NextResponse.json({ error: "preview_read_only" }, { status: 403 })
    }
  }
  if (isReadOnlyPreview() && (!["GET", "HEAD", "OPTIONS"].includes(request.method) || (pathname === "/auth/callback" && searchParams.has("code")))) {
    return NextResponse.json({ error: "preview_read_only" }, { status: 403 })
  }
  if (request.method === "GET" || request.method === "HEAD") {
    const destination = getCatalogRedirectPath(pathname, searchParams)
    if (destination) return NextResponse.redirect(new URL(destination, request.url), 308)
    if (pathname.startsWith("/catalog/") && !categoryFromCatalogPath(pathname)) {
      // loading.tsx can otherwise commit a streamed 200 before notFound() runs.
      const url = request.nextUrl.clone()
      url.pathname = "/catalog-not-found"
      url.search = ""
      return NextResponse.rewrite(url, { status: 404 })
    }
  }
  return await updateSession(request)
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
