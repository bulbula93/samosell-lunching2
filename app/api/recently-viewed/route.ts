import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { CatalogListing } from "@/types/marketplace"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const ids = (searchParams.get("ids") || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12)

  if (ids.length === 0) {
    return NextResponse.json({ items: [] })
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from("listings_catalog")
    .select(
      "id, seller_id, slug, title, description, price, currency, condition, city, material, color, gender, is_vip, is_promoted, is_featured, vip_until, promoted_until, featured_until, featured_slot, brand_name, size_label, category_name, category_slug, seller_username, seller_full_name, seller_created_at, seller_is_verified, cover_image_url, published_at, favorites_count, views_count, status"
    )
    .eq("status", "active")
    .in("id", ids)

  const orderMap = new Map(ids.map((id, index) => [id, index]))
  const items = ((data ?? []) as CatalogListing[]).sort((left, right) => {
    return (orderMap.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (orderMap.get(right.id) ?? Number.MAX_SAFE_INTEGER)
  })

  return NextResponse.json({ items })
}
