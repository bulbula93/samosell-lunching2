import { beforeEach, describe, expect, it, vi } from "vitest"
import { saveSellerPhoneAction } from "@/app/dashboard/profile/phone-actions"

const mocks = vi.hoisted(() => ({ client: vi.fn(), getUser: vi.fn(), from: vi.fn(), update: vi.fn(), eq: vi.fn(), select: vi.fn(), maybeSingle: vi.fn(), limit: vi.fn(), invalidate: vi.fn(), path: vi.fn(), preview: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }))
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: mocks.limit }))
vi.mock("@/lib/public-marketplace-invalidation", () => ({ invalidatePublicMarketplace: mocks.invalidate }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.path }))
vi.mock("@/lib/preview-read-only", () => ({ isReadOnlyPreview: mocks.preview }))

beforeEach(() => {
  vi.resetAllMocks()
  const query = { update: mocks.update, eq: mocks.eq, select: mocks.select, maybeSingle: mocks.maybeSingle }
  mocks.from.mockReturnValue(query); mocks.update.mockReturnValue(query); mocks.eq.mockReturnValue(query); mocks.select.mockReturnValue(query)
  mocks.client.mockResolvedValue({ auth: { getUser: mocks.getUser }, from: mocks.from })
  mocks.getUser.mockResolvedValue({ data: { user: { id: "current-owner" } }, error: null })
  mocks.maybeSingle.mockResolvedValue({ data: { id: "current-owner" }, error: null })
  mocks.preview.mockReturnValue(false)
})

describe("listing seller phone action", () => {
  it.each(["", "abc", "+123", "1".repeat(33), { phone: "+995555123456", id: "other-owner" }])("rejects invalid runtime input before any query: %s", async (value) => {
    expect(await saveSellerPhoneAction(value as string)).toMatchObject({ ok: false, code: "invalid" })
    expect(mocks.client).not.toHaveBeenCalled()
  })

  it("blocks read-only preview writes before opening a client", async () => {
    mocks.preview.mockReturnValue(true)
    expect(await saveSellerPhoneAction("+995555123456")).toMatchObject({ ok: false, code: "unavailable" })
    expect(mocks.client).not.toHaveBeenCalled()
  })

  it("requires authentication before rate limiting or updating", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    expect(await saveSellerPhoneAction("+995555123456")).toMatchObject({ ok: false, code: "unauthorized" })
    expect(mocks.limit).not.toHaveBeenCalled()
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("updates only the authenticated owner's phone and refreshes cached representations", async () => {
    expect(await saveSellerPhoneAction(" +995  555 12 34 56 ")).toEqual({ ok: true })
    expect(mocks.limit).toHaveBeenCalledWith(expect.anything(), "listing_status_update")
    expect(mocks.update).toHaveBeenCalledExactlyOnceWith({ store_phone: "+995 555 12 34 56" })
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith("id", "current-owner")
    expect(mocks.update.mock.invocationCallOrder[0]).toBeGreaterThan(mocks.limit.mock.invocationCallOrder[0])
    expect(mocks.select).toHaveBeenCalledWith("id")
    expect(mocks.invalidate).toHaveBeenCalledOnce()
    expect(mocks.path).toHaveBeenCalledWith("/dashboard/listings/new")
  })

  it.each([{ data: null, error: null }, { data: null, error: { message: "private database details" } }])("does not report success for an inaccessible or failed profile update", async (result) => {
    mocks.maybeSingle.mockResolvedValue(result)
    const response = await saveSellerPhoneAction("+995555123456")
    expect(response).toMatchObject({ ok: false, code: "unavailable" })
    expect(JSON.stringify(response)).not.toContain("private database details")
    expect(mocks.invalidate).not.toHaveBeenCalled()
  })

  it("stops the update when the rate limit is unavailable or exhausted", async () => {
    mocks.limit.mockRejectedValue(new Error("internal rate limit details"))
    expect(await saveSellerPhoneAction("+995555123456")).toMatchObject({ ok: false, code: "unavailable" })
    expect(mocks.update).not.toHaveBeenCalled()
  })

  it("keeps a successful write successful if cache invalidation fails", async () => {
    mocks.invalidate.mockImplementation(() => { throw new Error("cache unavailable") })
    expect(await saveSellerPhoneAction("+995555123456")).toEqual({ ok: true })
  })
})
