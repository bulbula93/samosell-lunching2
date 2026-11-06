import "server-only"
/**
 * Data for /links — the Instagram "link in bio" page.
 * Instagram captions cannot carry clickable links, so every listing post says "ბმული პროფილშია";
 * the profile link points here and this page lists the products we posted, newest first,
 * each linking straight to its listing.
 *
 * Cost: one cached read every 10 minutes (ISR + unstable_cache), never per visitor.
 * Privacy: only public listing fields; the admin client reads just social_posts.listing_id.
 */
import { unstable_cache } from "next/cache"
import { createAdminClient } from "@/lib/supabase/admin"
import { createPublicServerClient } from "@/lib/supabase/public-server"
import { withQueryTimeout } from "@/lib/supabase/query-timeout"
import { currentSocialRuntime } from "./runtime"

export type BioListing = { id: string; slug: string; title: string; price: number; currency: string; saleType: string | null; image: string }
export type BioData = { posted: BioListing[]; latest: BioListing[] }

const COLS = "id, slug, title, price, currency, sale_type, cover_image_url, status"
type Row = { id: string; slug: string | null; title: string | null; price: number | string | null; currency: string | null; sale_type: string | null; cover_image_url: string | null; status: string | null }

function toBio(r: Row): BioListing | null {
  if (r.status !== "active" || !r.slug || !r.title || !r.cover_image_url) return null
  return { id: r.id, slug: r.slug, title: r.title, price: Number(r.price ?? 0), currency: r.currency ?? "GEL", saleType: r.sale_type, image: r.cover_image_url }
}

/** Pure ordering helper (tested): keep social-post order, drop inactive/missing, de-duplicate. */
export function orderPosted(ids: string[], rows: Row[]): BioListing[] {
  const byId = new Map(rows.map(r => [r.id, r]))
  const seen = new Set<string>()
  const out: BioListing[] = []
  for (const id of ids) {
    if (seen.has(id)) continue
    seen.add(id)
    const row = byId.get(id)
    const item = row ? toBio(row) : null
    if (item) out.push(item)
  }
  return out
}

async function postedListingIds(): Promise<string[]> {
  if (!currentSocialRuntime().backendAllowed) return []
  const { data, error } = await withQueryTimeout(signal => createAdminClient().from("social_posts")
    .select("listing_id").in("status", ["published", "partially_published"]).not("listing_id", "is", null)
    .order("scheduled_for", { ascending: false }).limit(24).abortSignal(signal))
  if (error) throw new Error("LINK_IN_BIO_POSTS_FAILED")
  return (data ?? []).map(r => String((r as { listing_id: string }).listing_id))
}

async function load(): Promise<BioData> {
  const db = createPublicServerClient()
  const ids = await postedListingIds().catch(() => [] as string[])
  const [postedRes, latestRes] = await Promise.all([
    ids.length ? withQueryTimeout(signal => db.from("listings_catalog").select(COLS).in("id", ids).abortSignal(signal)) : Promise.resolve({ data: [], error: null }),
    withQueryTimeout(signal => db.from("listings_catalog").select(COLS).eq("status", "active").not("cover_image_url", "is", null)
      .order("published_at", { ascending: false, nullsFirst: false }).limit(12).abortSignal(signal)),
  ])
  if (latestRes.error) throw new Error("LINK_IN_BIO_LATEST_FAILED")
  const posted = orderPosted(ids, (postedRes.data ?? []) as Row[]).slice(0, 12)
  const postedIds = new Set(posted.map(p => p.id))
  const latest = ((latestRes.data ?? []) as Row[]).map(toBio).filter((x): x is BioListing => x !== null && !postedIds.has(x.id)).slice(0, 12)
  return { posted, latest }
}

export const getLinkInBioData = unstable_cache(load, ["social-link-in-bio-v1"], { revalidate: 600, tags: ["public-listings"] })
