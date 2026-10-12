import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { createBoostOrderAction, resumeBoostCheckoutAction } from "@/app/dashboard/boosts/actions"
import { getBoostPaymentConfig } from "@/lib/boost-payment-config"

const USER = "177f3329-6c04-4c40-8f33-873ab3ee4f76"
const LISTING = "bd7ec7ff-2aa1-486e-aa38-7ae5962531f5"
const ORDER = "c736ba7a-3c73-4264-8003-94e3dd8f0e67"
const CHECKOUT = "https://pay.flitt.com/checkout/fixture"
const mocks = vi.hoisted(() => ({
  createClient: vi.fn(), createAdminClient: vi.fn(), enforceRateLimit: vi.fn(),
  reconcileExpiredBoostOrders: vi.fn(), recordGrowthCheckout: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  redirect: (url: string) => { throw Object.assign(new Error(url), { digest: "NEXT_REDIRECT" }) },
  unstable_rethrow: (error: { digest?: string }) => { if (error?.digest === "NEXT_REDIRECT") throw error },
}))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }))
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mocks.createAdminClient }))
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }))
vi.mock("@/lib/growth/server", () => ({ recordGrowthCheckout: mocks.recordGrowthCheckout }))
vi.mock("@/lib/boost-reconciliation", () => ({ reconcileExpiredBoostOrders: mocks.reconcileExpiredBoostOrders, activateBoostOrder: vi.fn() }))
vi.mock("@/lib/tbc", () => ({ isTbcCheckoutEnabled: () => false, createTbcPayment: vi.fn() }))
vi.mock("@/lib/tbc-sync", () => ({ syncBoostOrderFromTbcByOrderId: vi.fn() }))
vi.mock("@/lib/listings", () => ({ humanizeSupabaseError: (message: string) => message }))
vi.mock("@/lib/site", () => ({ getSupportConfig: () => ({ responseTime: "24h", supportEmail: "support@example.invalid" }) }))

type Row = Record<string, unknown>

function database(orders: Row[] = [], options: { loseClaim?: boolean; attemptError?: boolean; lookupError?: boolean; user?: string | null } = {}) {
  const tables: Record<string, Row[]> = {
    listings: [{ id: LISTING, seller_id: USER, status: "active", title: "Zara", slug: "zara" }],
    listing_boost_products: [{ id: "vip_7d", name: "VIP", placement: "vip", duration_days: 7, price: 9.9, currency: "GEL", is_active: true }],
    listing_boost_orders: orders,
    flitt_payment_attempts: [], listing_boost_order_events: [],
  }
  const writes: { table: string; values: Row }[] = []
  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: options.user === null ? null : { id: options.user ?? USER } } }) },
    from(table: string) {
      const filters: ((row: Row) => boolean)[] = []
      let mutation: "insert" | "update" | null = null
      let values: Row = {}
      let limit = Infinity
      let result: { data: Row[] | null; error: { message: string } | null } | undefined
      const execute = () => {
        if (result) return result
        if ((mutation === "insert" && table === "flitt_payment_attempts" && options.attemptError)
          || (!mutation && table === "listing_boost_orders" && options.lookupError)) {
          return result = { data: null, error: { message: "database unavailable" } }
        }
        let rows = (tables[table] ?? []).filter(row => filters.every(matches => matches(row))).slice(0, limit)
        if (mutation === "update" && table === "listing_boost_orders" && values.payment_provider === "flitt" && options.loseClaim) rows = []
        if (mutation === "insert") {
          rows = [{ ...values }]
          tables[table].push(...rows)
          writes.push({ table, values: { ...values } })
        } else if (mutation === "update") {
          for (const row of rows) Object.assign(row, values)
          if (rows.length) writes.push({ table, values: { ...values } })
        }
        return result = { data: rows, error: null }
      }
      const query = {
        select: () => query,
        eq: (key: string, value: unknown) => { filters.push(row => row[key] === value); return query },
        is: (key: string, value: unknown) => { filters.push(row => (row[key] ?? null) === value); return query },
        in: (key: string, values: unknown[]) => { filters.push(row => values.includes(row[key])); return query },
        limit: (value: number) => { limit = value; return query },
        insert: (value: Row) => { mutation = "insert"; values = value; return query },
        update: (value: Row) => { mutation = "update"; values = value; return query },
        maybeSingle: async () => { const r = execute(); return { data: r.data?.[0] ?? null, error: r.error } },
        then: (resolve: (r: ReturnType<typeof execute>) => unknown) => Promise.resolve(execute()).then(resolve),
      }
      return query
    },
  }
  mocks.createClient.mockResolvedValue(client)
  mocks.createAdminClient.mockReturnValue(client)
  return { tables, writes, client }
}

function manualOrder(overrides: Row = {}): Row {
  return { id: ORDER, listing_id: LISTING, seller_id: USER, product_id: "vip_7d", status: "pending_payment", payment_method: "bank_transfer", payment_provider: null, provider_payment_id: null, provider_checkout_url: null, paid_at: null, approved_at: null, amount: 8.9, currency: "GEL", payment_reference: "original-reference", placement_snapshot: "vip", duration_days_snapshot: 7, ...overrides }
}

function newPurchase() {
  const form = new FormData()
  form.set("listingId", LISTING)
  form.set("productId", "vip_7d")
  form.set("paymentMethod", "flitt")
  form.set("amount", "0.01")
  return form
}

function recovery() {
  const form = new FormData()
  form.set("orderId", ORDER)
  form.set("confirmUnpaid", "yes")
  form.set("amount", "0.01")
  return form
}

let fetchMock: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
  vi.stubEnv("SITE_URL", "https://samosell.example")
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://samosell.example")
  vi.stubEnv("FLITT_MODE", "live")
  vi.stubEnv("VERCEL_ENV", "production")
  vi.stubEnv("NEXT_PUBLIC_FLITT_PAYMENTS_ENABLED", "true")
  vi.stubEnv("FLITT_MERCHANT_ID", "424242")
  vi.stubEnv("FLITT_SECRET_KEY", "unit-test-only-signing-key")
  vi.stubEnv("FLITT_API_URL", "https://payments.invalid")
  for (const key of ["BOOST_BANK_NAME", "BOOST_BANK_ACCOUNT", "BOOST_ACCOUNT_HOLDER"]) vi.stubEnv(key, "")
  fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ response: { checkout_url: CHECKOUT, payment_id: "9001", response_status: "success" } }), { status: 200 }))
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe("VIP live checkout and existing-order recovery", () => {
  it("offers configured Flitt Live on production and hides incomplete bank details", () => {
    expect(getBoostPaymentConfig()).toMatchObject({ flittCheckoutEnabled: true, flittMode: "live", hasBankDetails: false })
    vi.stubEnv("BOOST_BANK_NAME", "Bank only")
    expect(getBoostPaymentConfig().hasBankDetails).toBe(false)
  })

  it("still blocks sandbox payments on production", async () => {
    const db = database()
    vi.stubEnv("FLITT_MODE", "test")
    expect(getBoostPaymentConfig().flittCheckoutEnabled).toBe(false)
    await expect(createBoostOrderAction(newPurchase())).rejects.toThrow()
    expect(db.writes).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("creates a live attempt from trusted product pricing and redirects to Flitt", async () => {
    const db = database()
    await expect(createBoostOrderAction(newPurchase())).rejects.toThrow(CHECKOUT)
    const order = db.tables.listing_boost_orders[0]
    expect(db.tables.flitt_payment_attempts[0]).toMatchObject({ order_id: order.id, boost_order_id: order.id, mode: "live", amount: 990, status: "pending" })
    const request = JSON.parse(fetchMock.mock.calls[0][1].body).request
    expect(request).toMatchObject({ amount: 990, order_id: order.id, server_callback_url: "https://samosell.example/api/payments/flitt/callback" })
    expect(request.signature).toMatch(/^[a-f0-9]{40}$/)
    expect(order).toMatchObject({ status: "pending_payment", provider_checkout_url: CHECKOUT })
    expect(order.paid_at).toBeUndefined()
  })

  it("retains sandbox checkout in non-production previews", async () => {
    const db = database()
    vi.stubEnv("FLITT_MODE", "test")
    vi.stubEnv("VERCEL_ENV", "preview")
    await expect(createBoostOrderAction(newPurchase())).rejects.toThrow(CHECKOUT)
    expect(db.tables.flitt_payment_attempts[0].mode).toBe("test")
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).request.server_callback_url).toBe("https://example.supabase.co/functions/v1/flitt-callback")
  })

  it("does not create an order when card payments are disabled", async () => {
    const db = database()
    vi.stubEnv("NEXT_PUBLIC_FLITT_PAYMENTS_ENABLED", "false")
    await expect(createBoostOrderAction(newPurchase())).rejects.toThrow()
    expect(db.writes).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("rejects an unconfigured bank-transfer request instead of creating another blocked order", async () => {
    const db = database()
    const form = newPurchase(); form.set("paymentMethod", "bank_transfer")
    await expect(createBoostOrderAction(form)).rejects.toThrow("payment_unavailable")
    expect(db.writes).toEqual([])
  })

  it("reuses the seller's confirmed-unpaid order and its original amount and terms", async () => {
    const db = database([manualOrder()])
    await expect(resumeBoostCheckoutAction(recovery())).rejects.toThrow(CHECKOUT)
    expect(db.tables.listing_boost_orders).toHaveLength(1)
    expect(db.tables.listing_boost_orders[0]).toMatchObject({ id: ORDER, amount: 8.9, payment_method: "flitt", payment_provider: "flitt", placement_snapshot: "vip", duration_days_snapshot: 7 })
    expect(db.tables.flitt_payment_attempts[0]).toMatchObject({ order_id: ORDER, mode: "live", amount: 890 })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).request.amount).toBe(890)
  })

  it("requires explicit unpaid confirmation before changing the payment method", async () => {
    const db = database([manualOrder()])
    const form = recovery(); form.delete("confirmUnpaid")
    await expect(resumeBoostCheckoutAction(form)).rejects.toThrow("confirm_unpaid")
    expect(db.writes).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("cannot recover another seller's order", async () => {
    const db = database([manualOrder({ seller_id: "another-user" })])
    await expect(resumeBoostCheckoutAction(recovery())).rejects.toThrow("checkout_unavailable")
    expect(db.writes).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    { paid_at: "2026-10-11T20:00:00Z" }, { approved_at: "2026-10-11T20:00:00Z" },
    { status: "under_review" }, { status: "active" }, { payment_provider: "tbc_checkout" },
    { provider_payment_id: "existing-payment" }, { provider_checkout_url: CHECKOUT },
  ])("does not replace a paid, uncertain, or existing gateway payment: %j", async (changes) => {
    const db = database([manualOrder(changes)])
    await expect(resumeBoostCheckoutAction(recovery())).rejects.toThrow("checkout_unavailable")
    expect(db.writes).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("refuses recovery for an inactive listing", async () => {
    const db = database([manualOrder()]); db.tables.listings[0].status = "archived"
    await expect(resumeBoostCheckoutAction(recovery())).rejects.toThrow("checkout_listing_inactive")
    expect(db.writes).toEqual([])
  })

  it("creates no checkout when another request or admin wins the order claim", async () => {
    const db = database([manualOrder()], { loseClaim: true })
    await expect(resumeBoostCheckoutAction(recovery())).rejects.toThrow("checkout_unavailable")
    expect(db.tables.flitt_payment_attempts).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not send a second provider request after a repeated recovery click", async () => {
    const db = database([manualOrder()])
    await expect(resumeBoostCheckoutAction(recovery())).rejects.toThrow(CHECKOUT)
    await expect(resumeBoostCheckoutAction(recovery())).rejects.toThrow("checkout_unavailable")
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(db.tables.flitt_payment_attempts).toHaveLength(1)
  })

  it("keeps an uncertain provider outcome locked for reconciliation", async () => {
    const db = database([manualOrder()])
    fetchMock.mockRejectedValue(new Error("provider timeout"))
    await expect(resumeBoostCheckoutAction(recovery())).rejects.toThrow("checkout_failed")
    expect(db.tables.listing_boost_orders[0]).toMatchObject({ status: "under_review", payment_provider: "flitt" })
    await expect(resumeBoostCheckoutAction(recovery())).rejects.toThrow("checkout_unavailable")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("does not contact Flitt when the attempt cannot be persisted", async () => {
    const db = database([manualOrder()], { attemptError: true })
    await expect(resumeBoostCheckoutAction(recovery())).rejects.toThrow("checkout_failed")
    expect(db.tables.listing_boost_orders[0].status).toBe("under_review")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("does not bypass duplicate-package protection when an order lookup fails", async () => {
    const db = database([], { lookupError: true })
    await expect(createBoostOrderAction(newPurchase())).rejects.toThrow()
    expect(db.writes).toEqual([])
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
