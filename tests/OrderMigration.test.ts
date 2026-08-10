import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const migration = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260810165403_secure_marketplace_orders_foundation.sql",
  ),
  "utf8",
)

describe("secure marketplace orders migration", () => {
  it("creates the required order state machine and immutable amount snapshots", () => {
    for (const status of [
      "pending_payment",
      "paid",
      "seller_confirmed",
      "shipped",
      "delivered",
      "completed",
      "cancelled",
      "disputed",
      "refunded",
    ]) {
      expect(migration).toContain(`'${status}'`)
    }

    expect(migration).toContain("item_price numeric(10, 2) not null")
    expect(migration).toContain("delivery_price numeric(10, 2) not null")
    expect(migration).toContain("platform_fee numeric(10, 2) not null")
    expect(migration).toContain("buyer_protection_fee numeric(10, 2) not null")
    expect(migration).toContain("total_amount numeric(10, 2) generated always as")
    expect(migration).toContain("currency = 'GEL'")
  })

  it("allows participants to read only and blocks direct client mutations", () => {
    expect(migration).toContain("alter table public.marketplace_orders enable row level security")
    expect(migration).toContain("buyer_id = (select auth.uid())")
    expect(migration).toContain("seller_id = (select auth.uid())")
    expect(migration).toContain(
      "revoke all on table public.marketplace_orders from public, anon, authenticated",
    )
    expect(migration).toContain("grant select on table public.marketplace_orders to authenticated")
    expect(migration).not.toContain("grant insert on table public.marketplace_orders to authenticated")
    expect(migration).not.toContain("grant update on table public.marketplace_orders to authenticated")
  })

  it("uses a narrow authenticated transition RPC with ownership and concurrency checks", () => {
    expect(migration).toContain("security definer")
    expect(migration).toContain("set search_path = ''")
    expect(migration).toContain("v_actor_id uuid := auth.uid()")
    expect(migration).toContain("order_row.buyer_id = v_actor_id or order_row.seller_id = v_actor_id")
    expect(migration).toContain("for update")
    expect(migration).toContain("v_order.updated_at <> p_expected_updated_at")
    expect(migration).toContain("to authenticated")
  })

  it("reserves paid/refunded transitions for trusted provider code", () => {
    expect(migration).not.toContain("p_next_status = 'paid'")
    expect(migration).not.toContain("p_next_status = 'refunded'")
    expect(migration).toContain("v_order.status = 'paid' and p_next_status = 'seller_confirmed'")
    expect(migration).toContain("v_order.status = 'shipped' and p_next_status = 'delivered'")
  })

  it("does not invent an address model or authenticated order-creation RPC", () => {
    expect(migration).not.toMatch(/shipping_address|street_address|phone_number/)
    expect(migration).not.toMatch(/create_marketplace_order\s*\(/)
  })
})
