import { beforeEach, describe, expect, it, vi } from "vitest"
import { updateListingStatusAction } from "@/app/dashboard/listings/actions"

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rateLimit: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.rateLimit,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

const ownerId = "177f3329-6c04-4c40-8f33-873ab3ee4f76"
const listingId = "277f3329-6c04-4c40-8f33-873ab3ee4f76"
const updatedAt = "2026-08-04T08:00:00.000Z"

function auth(user: { id: string } | null) {
  return {
    getUser: vi.fn().mockResolvedValue({
      data: { user },
      error: null,
    }),
  }
}

function lookupBuilder(data: Record<string, unknown> | null, error: Error | null = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  }
}

function updateBuilder(
  data: Record<string, unknown> | null,
  error: Error | null = null
) {
  let payload: Record<string, unknown> | null = null
  const builder = {
    update: vi.fn((nextPayload: Record<string, unknown>) => {
      payload = nextPayload
      return builder
    }),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
    getPayload: () => payload,
  }
  return builder
}

describe("my listings status action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rateLimit.mockResolvedValue(undefined)
  })

  it("denies an unauthenticated mutation before database access", async () => {
    const from = vi.fn()
    mocks.createClient.mockResolvedValue({ auth: auth(null), from })

    const result = await updateListingStatusAction({
      listingId,
      nextStatus: "reserved",
      expectedUpdatedAt: updatedAt,
    })

    expect(result).toMatchObject({ ok: false, code: "unauthorized" })
    expect(from).not.toHaveBeenCalled()
    expect(mocks.rateLimit).not.toHaveBeenCalled()
  })

  it("returns the same private-safe denial for a forged non-owner id", async () => {
    const lookup = lookupBuilder(null)
    mocks.createClient.mockResolvedValue({
      auth: auth({ id: ownerId }),
      from: vi.fn().mockReturnValue(lookup),
    })

    const result = await updateListingStatusAction({
      listingId,
      nextStatus: "reserved",
      expectedUpdatedAt: updatedAt,
    })

    expect(result).toMatchObject({ ok: false, code: "not_found" })
    expect(lookup.eq).toHaveBeenCalledWith("id", listingId)
    expect(lookup.eq).toHaveBeenCalledWith("seller_id", ownerId)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("rejects unsupported status injection and stale updates", async () => {
    const listing = {
      id: listingId,
      slug: "test-listing",
      status: "active",
      updated_at: updatedAt,
      published_at: "2026-08-03T08:00:00.000Z",
    }
    const lookupInvalid = lookupBuilder(listing)
    const lookupStale = lookupBuilder(listing)
    const from = vi
      .fn()
      .mockReturnValueOnce(lookupInvalid)
      .mockReturnValueOnce(lookupStale)

    mocks.createClient.mockResolvedValue({ auth: auth({ id: ownerId }), from })

    const invalid = await updateListingStatusAction({
      listingId,
      nextStatus: "pending_review",
      expectedUpdatedAt: updatedAt,
    })
    const stale = await updateListingStatusAction({
      listingId,
      nextStatus: "reserved",
      expectedUpdatedAt: "2026-08-04T07:00:00.000Z",
    })

    expect(invalid).toMatchObject({ ok: false, code: "invalid" })
    expect(stale).toMatchObject({ ok: false, code: "conflict" })
    expect(from).toHaveBeenCalledTimes(2)
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("updates only allowed fields on an owned listing and revalidates every consumer", async () => {
    const lookup = lookupBuilder({
      id: listingId,
      slug: "test-listing",
      status: "active",
      updated_at: updatedAt,
      published_at: "2026-08-03T08:00:00.000Z",
    })
    const nextUpdatedAt = "2026-08-04T08:05:00.000Z"
    const update = updateBuilder({
      status: "reserved",
      updated_at: nextUpdatedAt,
    })
    const from = vi.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(update)
    mocks.createClient.mockResolvedValue({ auth: auth({ id: ownerId }), from })

    const result = await updateListingStatusAction({
      listingId,
      nextStatus: "reserved",
      expectedUpdatedAt: updatedAt,
    })

    expect(result).toEqual({
      ok: true,
      status: "reserved",
      updatedAt: nextUpdatedAt,
      message: "განცხადება დაჯავშნილად მოინიშნა.",
    })
    expect(update.getPayload()).toEqual({
      status: "reserved",
      published_at: "2026-08-03T08:00:00.000Z",
      sold_to_user_id: null,
    })
    expect(update.getPayload()).not.toHaveProperty("seller_id")
    expect(update.eq).toHaveBeenCalledWith("id", listingId)
    expect(update.eq).toHaveBeenCalledWith("seller_id", ownerId)
    expect(update.eq).toHaveBeenCalledWith("updated_at", updatedAt)
    expect(mocks.rateLimit).toHaveBeenCalledWith(expect.anything(), "listing_status_update")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/catalog")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/dashboard/listings")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/listing/test-listing")
  })

  it("restores archived listings privately as drafts", async () => {
    const lookup = lookupBuilder({
      id: listingId,
      slug: "test-listing",
      status: "archived",
      updated_at: updatedAt,
      published_at: "2026-08-03T08:00:00.000Z",
    })
    const update = updateBuilder({
      status: "draft",
      updated_at: "2026-08-04T08:05:00.000Z",
    })
    mocks.createClient.mockResolvedValue({
      auth: auth({ id: ownerId }),
      from: vi.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(update),
    })

    const result = await updateListingStatusAction({
      listingId,
      nextStatus: "draft",
      expectedUpdatedAt: updatedAt,
    })

    expect(result).toMatchObject({ ok: true, status: "draft" })
    expect(update.getPayload()).toEqual({ status: "draft", published_at: null, sold_to_user_id: null })
  })

  it("blocks publication when the authenticated seller has no contact phone", async () => {
    const lookup = lookupBuilder({
      id: listingId,
      slug: "test-listing",
      status: "draft",
      updated_at: updatedAt,
      published_at: null,
    })
    const profile = lookupBuilder({ store_phone: null })
    const from = vi.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(profile)
    mocks.createClient.mockResolvedValue({ auth: auth({ id: ownerId }), from })

    const result = await updateListingStatusAction({
      listingId,
      nextStatus: "active",
      expectedUpdatedAt: updatedAt,
    })

    expect(result).toMatchObject({ ok: false, code: "invalid" })
    expect(result.message).toContain("ტელეფონი")
    expect(from).toHaveBeenNthCalledWith(2, "profiles")
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })

  it("keeps database details private on a failed update", async () => {
    const lookup = lookupBuilder({
      id: listingId,
      slug: "test-listing",
      status: "active",
      updated_at: updatedAt,
      published_at: null,
    })
    const update = updateBuilder(null, new Error("postgres secret detail"))
    mocks.createClient.mockResolvedValue({
      auth: auth({ id: ownerId }),
      from: vi.fn().mockReturnValueOnce(lookup).mockReturnValueOnce(update),
    })

    const result = await updateListingStatusAction({
      listingId,
      nextStatus: "reserved",
      expectedUpdatedAt: updatedAt,
    })

    expect(result).toMatchObject({ ok: false, code: "server_error" })
    if (!result.ok) expect(result.message).not.toContain("postgres")
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})
