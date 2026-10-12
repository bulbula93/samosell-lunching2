// @vitest-environment node
import { readFileSync } from "node:fs"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({
  update: vi.fn(),
  clauses: [] as Array<[string, unknown, unknown?]>,
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/growth/server", () => ({ scheduleGrowthMetaDelivery: vi.fn() }))
vi.mock("@/lib/admin-activity-email", () => ({ notifyAdminBoostPurchase: vi.fn() }))
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      update: (values: Record<string,unknown>) => {
        mock.update(table, values)
        mock.clauses = []
        const chain = {
          eq: (field: string, value: unknown) => {
            mock.clauses.push(["eq",field,value])
            return chain
          },
          is: (field: string, value: unknown) => {
            mock.clauses.push(["is",field,value])
            return chain
          },
          select: (field: string) => {
            mock.clauses.push(["select",field])
            return chain
          },
          maybeSingle: async () => ({ data: {id: "test-order"},error:null }),
        }
        return chain
      },
    }),
  }),
}))

import { isVerifiedUnpaidFlittTerminal, reconcileUnpaidFlittBoostFailure } from "@/lib/flitt-boost"

const yes = {nextStatus:"expired",providerStatus:"expired",responseStatus:"success"}
beforeEach(() => {mock.update.mockReset();mock.clauses=[]})

describe("Flitt unpaid boost reconciliation safety", () => {
  it("only accepts a confirmed failed/expired/declined status from server verification", () => {
    expect(isVerifiedUnpaidFlittTerminal(yes)).toBe(true)
    expect(isVerifiedUnpaidFlittTerminal({nextStatus:"declined",providerStatus:"declined",responseStatus:"success"})).toBe(true)
    expect(isVerifiedUnpaidFlittTerminal({nextStatus:"approved",providerStatus:"approved",responseStatus:"success"})).toBe(false)
    expect(isVerifiedUnpaidFlittTerminal({nextStatus:"expired",providerStatus:"approved",responseStatus:"success"})).toBe(false)
    expect(isVerifiedUnpaidFlittTerminal({nextStatus:"expired",providerStatus:"expired",responseStatus:"error"})).toBe(false)
    expect(isVerifiedUnpaidFlittTerminal({nextStatus:"pending",providerStatus:"processing",responseStatus:"success"})).toBe(false)
  })
  it("rejects a forged terminal update before accessing the database", async () => {
    await expect(reconcileUnpaidFlittBoostFailure("order", {nextStatus:"expired",providerStatus:"approved",responseStatus:"success"})).rejects.toThrow("independently verified")
    expect(mock.update).not.toHaveBeenCalled()
  })
  it("compare-and-set cancels only unpaid flitt pending boost orders", async () => {
    expect(await reconcileUnpaidFlittBoostFailure("test-order", yes)).toEqual({reconciled:true})
    expect(mock.update).toHaveBeenCalledWith("listing_boost_orders", expect.objectContaining({
      status:"cancelled",provider_status:"expired",failure_reason:expect.any(String),
    }))
    expect(mock.clauses).toEqual(expect.arrayContaining([
      ["eq","id","test-order"],
      ["eq","status","pending_payment"],
      ["eq","payment_provider","flitt"],
      ["is","paid_at",null],
      ["is","approved_at",null],
    ]))
    expect(JSON.stringify(mock.update.mock.calls)).not.toContain("active")
  })
  it("calls the reconciler from authoritative callbacks and payment result refresh only", () => {
    const callback=readFileSync("app/api/payments/flitt/callback/route.ts","utf8")
    const payment=readFileSync("app/payment/result/page.tsx","utf8")
    const billing=readFileSync("app/dashboard/billing/page.tsx","utf8")
    expect(callback).toContain("independentlyFailed")
    expect(callback).toContain("reconcileUnpaidFlittBoostFailure(attempt.boost_order_id, verified)")
    expect(payment).toContain("isVerifiedUnpaidFlittTerminal")
    expect(billing).toContain('["expired", "declined", "failed"].includes')
    expect(billing).toContain("გადახდის სტატუსის გადამოწმება")
    const admin = readFileSync("app/admin/payments/actions.ts","utf8")
    expect(admin).toContain("isVerifiedUnpaidFlittTerminal(verified)")
    expect(admin).toContain("reconcileUnpaidFlittBoostFailure(attempt.boost_order_id, verified)")
  })
})

describe("Mobile stability safeguards", () => {
  it("prioritizes only the large above-the-fold gallery asset", () => {
    const gallery=readFileSync("components/listings/ListingGallery.tsx","utf8")
    const smart=readFileSync("components/shared/SmartImage.tsx","utf8")
    expect(gallery).toContain('loading="eager"\n          priority')
    expect(smart).toContain("priority={priority}")
  })
  it("moves delayed story personalization below core homepage content", () => {
    const home=readFileSync("components/home/HomePageContent.tsx","utf8")
    expect(home.indexOf("<HomeStoriesSlot/>")).toBeGreaterThan(home.indexOf("<HomeHowItWorks/>"))
  })
  it("retains a bounded catalog retry with a new stateless PostgREST client", () => {
    const home=readFileSync("lib/home-page.ts","utf8")
    expect(home).toContain("const retryClient = createPublicServerClient()")
    expect(home).toContain("home_public_data_retry")
    expect(home).toContain("throw new Error(`home_public_data_unavailable:")
  })
  it("does not block a valid listing merely because related inventory queries failed", () => {
    const listing=readFileSync("lib/listing-page.ts","utf8")
    expect(listing).toContain("listing_related_optional_unavailable")
    const errorSection=listing.split("const criticalError =")[1].split("if (criticalError)")[0]
    expect(errorSection).not.toContain("similarCategoryResponse.error")
    expect(errorSection).not.toContain("similarBrandResponse.error")
  })
})
