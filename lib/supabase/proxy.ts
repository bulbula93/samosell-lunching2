import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"
import { getPublicEnv } from "@/lib/env"

const LISTING_PATH_PATTERN = /^\/listing\/([^/]+)$/
const LISTING_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/i
const PROXY_VISIBLE_LISTING_STATUSES = new Set(["active", "reserved", "sold"])

export function getListingSlugFromPathname(pathname: string) {
  const match = pathname.match(LISTING_PATH_PATTERN)
  if (!match) return null

  try {
    return decodeURIComponent(match[1])
  } catch {
    return ""
  }
}

export function canServeListingFromProxy(
  listing: { status?: string | null } | null,
) {
  return Boolean(
    listing && PROXY_VISIBLE_LISTING_STATUSES.has(String(listing.status ?? "")),
  )
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  const env = getPublicEnv()

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))

        supabaseResponse = NextResponse.next({ request })

        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  const { data: claimsData } = await supabase.auth.getClaims()

  const listingSlug = getListingSlugFromPathname(request.nextUrl.pathname)
  if (listingSlug !== null) {
    const listingResponse = LISTING_SLUG_PATTERN.test(listingSlug)
      ? await supabase
          .from("listings_catalog")
          .select("id, status")
          .eq("slug", listingSlug)
          .maybeSingle()
      : { data: null, error: null }

    if (!listingResponse.error && !canServeListingFromProxy(listingResponse.data)) {
      const notFoundUrl = request.nextUrl.clone()
      notFoundUrl.pathname = "/listing-not-found"
      notFoundUrl.search = ""

      const notFoundResponse = NextResponse.rewrite(notFoundUrl, { status: 404 })
      for (const cookie of supabaseResponse.cookies.getAll()) {
        notFoundResponse.cookies.set(cookie)
      }
      return notFoundResponse
    }
  }

  if (request.nextUrl.pathname.startsWith("/dashboard") && !claimsData?.claims?.sub) {
    const returnPath = getSafeAuthRedirectPath(
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
      "/dashboard"
    )
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = "/login"
    loginUrl.search = ""
    loginUrl.searchParams.set("next", returnPath)

    const redirectResponse = NextResponse.redirect(loginUrl)
    for (const cookie of supabaseResponse.cookies.getAll()) {
      redirectResponse.cookies.set(cookie)
    }
    return redirectResponse
  }

  return supabaseResponse
}
