import { beforeEach, describe, expect, it, vi } from "vitest"
import { transitionMarketplaceOrderAction } from "@/app/dashboard/orders/actions"

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rateLimit: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.createClient }))
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: mocks.rateLimit }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }))

const userId = "177f3329-6c04-4c40-8f33-873ab3ee4f76"
const sellerId = "277f3329-6c04-4c40-8f33-873ab3ee4f76"
const orderId = "377f3329-6c04-4c40-8f33-873ab3ee4f76"
const updatedAt = "2026-08-10T16:00:00.000Z"

function auth(user: { id: string } | null) {
  return {
    getUser: vi.fn().mockResolvedValue({ data: { user }, error: null }),
  }
}

function lookupBuilder(data: Record<string, unknown> | null, error: { message: string } | null = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  }
}

function rpcBuilder(data: Record<string, unknown> | null, error: { message: string; code?: string } | null = null) {
  return { maybeSingle: vi.fn().mockResolvedValue({ data, error }) }
}

describe("marketplace order transition action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rateLimit.mockResolvedValue(undefined)
  })

  it("denies unauthenticated mutations before order access", async () => {
    const from = vi.fn()
    mocks.createClient.mockResolvedValue({ auth: auth(null), from })

    const result = await transitionMarketplaceOrderAction({
      orderId,
      nextStatus: "cancelled",
      expectedUpdatedAt: updatedAt,
    })

    expect(result).toMatchObject({ ok: false, code: "unauthorized" })
    expect(from).not.toHaveBeenCalled()
  })

  it("rejects status injection before database access", async () => {
    const from = vi.fn()
    mocks.createClient.mockResolvedValue({ auth: auth({ id: userId }), from })

    const result = await transitionMarketplaceOrderAction({
      orderId,
      nextStatus: "admin_approved",
      expectedUpdatedAt: updatedAt,
    })

    expect(result).toMatchObject({ ok: false, code: "invalid" })
    expect(from).not.toHaveBeenCalled()
  })

  it("returns the same private-safe denial for a forged non-participant id", async () => {
    const lookup = lookupBuilder(null)
    mocks.createClient.mockResolvedValue({
      auth: auth({ id: userId }),
      from: vi.fn().mockReturnValue(lookup),
    })

    const result = await transitionMarketplaceOrderAction({
      orderId,
      nextStatus: "cancelled",
      expectedUpdatedAt: updatedAt,
    })

    expect(result).toMatchObject({ ok: false, code: "not_found" })
    expect(lookup.eq).toHaveBeenCalledWith("id", orderId)
    expect(lookup.or).toHaveBeenCalledWith(`buyer_id.eq.${userId},seller_id.eq.${userId}`)
  })

  it("rejects a buyer attempting a seller-only transition", async () => {
    const lookup = lookupBuilder({
      id: orderId,
      buyer_id: userId,
      seller_id: sellerId,
      status: "paid",
      updated_at: updatedAt,
      listing_slug: "test-listing",
    })
    const rpc = vi.fn()
    mocks.createClient.mockResolvedValue({
      auth: auth({ id: userId }),
      from: vi.fn().mockReturnValue(lookup),
      rpc,
    })

    const result = await transitionMarketplaceOrderAction({
      orderId,
      nextStatus: "seller_confirmed",
      expectedUpdatedAt: updatedAt,
    })

    expect(result).toMatchObject({ ok: false, code: "invalid" })
    expect(rpc).not.toHaveBeenCalled()
  })

  it("calls the independently protected RPC for a valid seller transition", async () => {
    const lookup = lookupBuilder({
      id: orderId,
      buyer_id: userId,
      seller_id: sellerId,
      status: "paid",
      updated_at: updatedAt,
      listing_slug: "test-listing",
    })
    const nextUpdatedAt = "2026-08-10T16:05:00.000Z"
    const rpcResult = rpcBuilder({
      order_id: orderId,
      status: "seller_confirmed",
      updated_at: nextUpdatedAt,
      listing_slug: "test-listing",
    })
    const rpc = vi.fn().mockReturnValue(rpcResult)
    mocks.createClient.mockResolvedValue({
      auth: auth({ id: sellerId }),
      from: vi.fn().mockReturnValue(lookup),
      rpc,
    })

    const result = await transitionMarketplaceOrderAction({
      orderId,
      nextStatus: "seller_confirmed",
      expectedUpdatedAt: updatedAt,
    })

    expect(result).toEqual({
      ok: true,
      status: "seller_confirmed",
      updatedAt: nextUpdatedAt,
      message: "შეკვეთის სტატუსი განახლდა: გამყიდველმა დაადასტურა.",
    })
    expect(rpc).toHaveBeenCalledWith("transition_marketplace_order", {
      p_order_id: orderId,
      p_next_status: "seller_confirmed",
      p_expected_updated_at: updatedAt,
    })
    expect(mocks.rateLimit).toHaveBeenCalledWith(expect.anything(), "order_status_update")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/orders")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/listing/test-listing")
  })

  it("keeps raw database errors private", async () => {
    const lookup = lookupBuilder({
      id: orderId,
      buyer_id: userId,
      seller_id: sellerId,
      status: "pending_payment",
      updated_at: updatedAt,
      listing_slug: "test-listing",
    })
    const rpc = vi.fn().mockReturnValue(rpcBuilder(null, { message: "postgres secret detail" }))
    mocks.createClient.mockResolvedValue({
      auth: auth({ id: userId }),
      from: vi.fn().mockReturnValue(lookup),
      rpc,
    })

    const result = await transitionMarketplaceOrderAction({
      orderId,
      nextStatus: "cancelled",
      expectedUpdatedAt: updatedAt,
    })

    expect(result).toMatchObject({ ok: false, code: "server_error" })
    if (!result.ok) expect(result.message).not.toContain("postgres")
  })
})
