import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260810153247_secure_seller_reviews.sql",
  ),
  "utf8",
)

describe("secure seller reviews migration", () => {
  it("removes direct mutations and exposes public reads only", () => {
    expect(migration).toContain(
      "revoke all on table public.listing_reviews from public, anon, authenticated",
    )
    expect(migration).toContain(
      "grant select on table public.listing_reviews to anon, authenticated",
    )
    expect(migration).not.toContain("grant insert on table public.listing_reviews")
    expect(migration).not.toContain("grant update on table public.listing_reviews")
  })

  it("derives reviewer and seller from authenticated database state", () => {
    expect(migration).toContain("v_reviewer_id uuid := auth.uid()")
    expect(migration).toContain("select listing.seller_id")
    expect(migration).toContain("where listing.id = p_listing_id")
    expect(migration).not.toContain("p_seller_id")
    expect(migration).not.toContain("p_reviewer_id")
  })

  it("permits a review only for a sold listing and its buyer chat", () => {
    expect(migration).toContain("listing.status = 'sold'")
    expect(migration).toContain("from public.chats chat")
    expect(migration).toContain("chat.buyer_id = v_reviewer_id")
    expect(migration).toContain("chat.seller_id = v_seller_id")
    expect(migration).toContain("from public.user_blocks block_row")
  })

  it("uses a narrow security definer RPC and invoker-safe aggregate view", () => {
    expect(migration).toContain("security definer")
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain("public.upsert_listing_review")
    expect(migration).toContain("to authenticated")
    expect(migration).toContain("with (security_invoker = true)")
  })
})
