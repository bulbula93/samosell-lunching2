import { ImageResponse } from "next/og"
import { createClient } from "@/lib/supabase/server"
import { formatPrice } from "@/lib/listings"
import { SITE_NAME } from "@/lib/site"

export const size = {
  width: 1200,
  height: 630,
}

export const contentType = "image/png"

export default async function ListingOpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createClient()
  const { data: listing } = await supabase
    .from("listings_catalog")
    .select("title, price, currency, category_name, brand_name, city, seller_username")
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle()

  const title = listing?.title || SITE_NAME
  const price = listing ? formatPrice(listing.price, listing.currency) : "Fashion marketplace"
  const meta = [listing?.category_name, listing?.brand_name, listing?.city].filter(Boolean).join(" · ")

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 56,
          background: "linear-gradient(135deg, #faf5ff 0%, #ffffff 55%, #eff6ff 100%)",
          color: "#111827",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 800 }}>{SITE_NAME}</div>
          <div style={{ fontSize: 22, opacity: 0.7 }}>Listing preview</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1.08 }}>{title}</div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>{price}</div>
          <div style={{ fontSize: 28, opacity: 0.8 }}>{meta || `Find more items on ${SITE_NAME}`}</div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 24, opacity: 0.72 }}>{listing?.seller_username ? `@${listing.seller_username}` : "Fashion marketplace"}</div>
          <div style={{ display: "flex", gap: 12 }}>
            {["Secure seller cards", "Fast chat", "Favorites"].map((item) => (
              <div
                key={item}
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderRadius: 999,
                  padding: "12px 18px",
                  background: "rgba(17,24,39,0.06)",
                  fontSize: 20,
                }}
              >
                {item}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    size
  )
}
