// Deterministic public read fixture for CI builds and matched local benchmarks.
// No credentials or external services are used.
import http from "node:http"

export function createPublicCacheFixture(onRequest = () => {}) {
  const sellerId = "11111111-1111-4111-8111-111111111111"
  const seller = { id: sellerId, username: "benchmark_seller", full_name: "Benchmark seller", city: "თბილისი", bio: "Public fixture",
    created_at: "2025-01-01T00:00:00Z", is_suspended: false, is_seller_verified: true, seller_type: "individual" }
  const listings = Array.from({ length: 20 }, (_, i) => ({
    id: `22222222-2222-4222-8222-${String(i).padStart(12, "0")}`, public_id: `SS-${String(i).padStart(8, "0")}`,
    slug: i === 0 ? "benchmark-listing" : `benchmark-${i}`, title: `Public listing ${i}`, description: "Deterministic public listing fixture",
    price: 40 + i, currency: "GEL", condition: "good", sale_type: "sale", status: "active", city: "თბილისი", gender: "women",
    seller_id: sellerId, seller_username: seller.username, seller_full_name: seller.full_name, seller_created_at: seller.created_at,
    seller_type: "individual", seller_is_verified: true, brand_name: "Benchmark", category_name: "ქურთუკები", category_slug: "women",
    published_at: "2026-10-01T00:00:00Z", cover_image_url: null, favorites_count: i, views_count: i * 10,
    is_vip: false, is_promoted: false, is_featured: false, is_home_banner: false,
    vip_until: null, promoted_until: null, featured_until: null, home_banner_until: null,
  }))
  const fixture = http.createServer((req, res) => {
    onRequest()
    const url = new URL(req.url, "http://fixture")
    const table = url.pathname.split("/").at(-1)
    if (!["GET", "HEAD"].includes(req.method) && !(req.method === "POST" && table === "get_public_seller_listing_counts")) {
      res.writeHead(405, { "Content-Type": "application/json" }); res.end(JSON.stringify({ error: "fixture_read_only" })); return
    }
    let data = table === "profiles" ? [seller] : ["listings_catalog", "listings"].includes(table) ? listings
      : table === "get_public_seller_listing_counts" ? [{ active_count: listings.length, sold_count: 0 }]
      : table === "seller_review_summaries" ? [{ review_count: 0, average_score: null }] : []
    for (const [key, value] of url.searchParams) {
      if (value.startsWith("eq.")) data = data.filter((row) => String(row[key]) === value.slice(3))
      if (value.startsWith("neq.")) data = data.filter((row) => String(row[key]) !== value.slice(4))
    }
    const count = data.length
    if (url.searchParams.has("limit")) data = data.slice(0, Number(url.searchParams.get("limit")))
    const single = String(req.headers.accept).includes("vnd.pgrst.object")
    res.writeHead(200, { "Content-Type": "application/json", "Content-Range": `0-${Math.max(0, count - 1)}/${count}` })
    res.end(req.method === "HEAD" ? undefined : JSON.stringify(single ? data[0] ?? null : data))
  })
  return fixture
}
