import { NextResponse } from "next/server"
import { createPublicServerClient } from "@/lib/supabase/public-server"

export const dynamic = "force-dynamic"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, {
    status,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow, noarchive",
      "Referrer-Policy": "same-origin",
    },
  })
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin")
  const requestOrigin = new URL(request.url).origin

  if (origin && origin !== requestOrigin) {
    return json({ error: "forbidden" }, 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: "invalid_body" }, 400)
  }

  if (!body || typeof body !== "object") {
    return json({ error: "invalid_body" }, 400)
  }

  const input = body as Record<string, unknown>
  const listingId =
    typeof input.listingId === "string" ? input.listingId.trim() : ""
  const sellerUsername =
    typeof input.sellerUsername === "string" ? input.sellerUsername.trim() : ""

  if (
    (!listingId && !sellerUsername) ||
    (listingId && !UUID_PATTERN.test(listingId)) ||
    sellerUsername.length > 80
  ) {
    return json({ error: "invalid_target" }, 400)
  }

  const supabase = createPublicServerClient()
  let sellerId = ""

  if (listingId) {
    const { data: listing, error: listingError } = await supabase
      .from("listings_catalog")
      .select("seller_id, status")
      .eq("id", listingId)
      .maybeSingle()

    if (listingError || !listing || listing.status !== "active" || !listing.seller_id) {
      return json({ error: "not_found" }, 404)
    }

    sellerId = listing.seller_id
  }

  let profileQuery = supabase
    .from("profiles")
    .select("store_phone, is_suspended")

  profileQuery = sellerId
    ? profileQuery.eq("id", sellerId)
    : profileQuery.eq("username", sellerUsername)

  const { data: profile, error: profileError } = await profileQuery.maybeSingle()

  if (
    profileError ||
    !profile ||
    profile.is_suspended ||
    typeof profile.store_phone !== "string" ||
    !profile.store_phone.trim()
  ) {
    return json({ error: "not_found" }, 404)
  }

  return json({ phone: profile.store_phone.trim() })
}
