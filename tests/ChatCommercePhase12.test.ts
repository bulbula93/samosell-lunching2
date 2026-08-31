import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const migration = read("supabase/migrations/20260831061706_add_chat_conversion_phase_12.sql")
const hardening = read("supabase/migrations/20260831062332_resolve_stale_chat_offers_phase_12.sql")
const actions = read("app/dashboard/chats/commerce-actions.ts")
const page = read("app/dashboard/chats/[chatId]/page.tsx")
const panel = read("components/chat/ChatCommercePanel.tsx")
const rateLimit = read("lib/rate-limit.ts")

describe("Phase 12 chat conversion", () => {
  it("keeps offers participant-readable but RPC-written", () => {
    expect(migration).toContain("create table if not exists public.chat_offers")
    expect(migration).toContain("revoke all on table public.chat_offers from public, anon, authenticated")
    expect(migration).toContain("grant select on table public.chat_offers to authenticated")
    expect(migration).toContain("chat_offers_select_participants")
  })

  it("binds reservations to the selected chat buyer", () => {
    expect(migration).toContain("reserved_for_user_id")
    expect(migration).toContain("public.reserve_chat_listing")
    expect(migration).toContain("public.release_chat_reservation")
    expect(migration).toContain("reserved_for_other_buyer")
  })

  it("reuses the existing sold review lifecycle", () => {
    expect(migration).toContain("public.complete_chat_sale")
    expect(migration).toContain("set status = 'sold', sold_to_user_id = v_chat.buyer_id")
    expect(actions).toContain('supabase.rpc("complete_chat_sale"')
    expect(actions).toContain("შეფასების მოთხოვნაც გაიგზავნა")
  })

  it("supports structured offers and seller responses", () => {
    expect(migration).toContain("public.create_chat_offer")
    expect(migration).toContain("public.respond_chat_offer")
    expect(migration).toContain("offer_created")
    expect(migration).toContain("offer_accepted")
    expect(migration).toContain("offer_rejected")
    expect(panel).toContain("შესთავაზე ფასი")
    expect(panel).toContain("მიღება და დაჯავშნა")
  })

  it("resolves stale pending offers when a listing is reserved or sold", () => {
    expect(hardening).toContain("status = case when o.buyer_id = v_chat.buyer_id then 'accepted' else 'rejected' end")
    expect(hardening).toContain("status = case when o.buyer_id = v_chat.buyer_id then 'completed' else 'rejected' end")
    expect(hardening).toContain("reserved_for_another_buyer")
    expect(hardening).toContain("listing_sold")
  })

  it("adds abuse controls", () => {
    expect(migration).toContain("interval '30 seconds'")
    expect(migration).toContain("chat_commerce")
    expect(rateLimit).toContain("chat_commerce")
    expect(rateLimit).toContain("maxHits: 20")
  })

  it("shows commerce controls and counterparty profile from the chat thread", () => {
    expect(page).toContain("ChatCommercePanel")
    expect(page).toContain('.from("chat_offers")')
    expect(page).toContain("reserved_for_user_id")
    expect(page).toContain("პროფილის ნახვა")
  })
})
