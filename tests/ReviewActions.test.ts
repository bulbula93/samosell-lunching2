import { beforeEach, describe, expect, it, vi } from "vitest"
import { upsertListingReviewAction } from "@/app/reviews/actions"

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

const listingId = "277f3329-6c04-4c40-8f33-873ab3ee4f76"

describe("review server action", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`REDIRECT:${path}`)
    })
  })

  it("sends only listing, score, and comment to the session-scoped RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "review-id", error: null })
    mocks.requireAuthenticatedUser.mockResolvedValue({
      supabase: { rpc },
      user: { id: "current-user" },
    })
    const formData = new FormData()
    formData.set("listingId", listingId)
    formData.set("listingSlug", "linen-jacket")
    formData.set("score", "5")
    formData.set("comment", "  ძალიან კარგი გამოცდილება  ")
    formData.set("sellerId", "forged-seller")
    formData.set("reviewerId", "forged-reviewer")

    await expect(upsertListingReviewAction(formData)).rejects.toThrow(
      "REDIRECT:/listing/linen-jacket?review=saved",
    )

    expect(rpc).toHaveBeenCalledWith("upsert_listing_review", {
      p_listing_id: listingId,
      p_score: 5,
      p_comment: "ძალიან კარგი გამოცდილება",
    })
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("sellerId")
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("reviewerId")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/listing/linen-jacket")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/seller/[username]", "page")
  })

  it("rejects invalid scores before authentication or database access", async () => {
    const formData = new FormData()
    formData.set("listingId", listingId)
    formData.set("listingSlug", "linen-jacket")
    formData.set("score", "6")

    await expect(upsertListingReviewAction(formData)).rejects.toThrow(
      "REDIRECT:/listing/linen-jacket?review=invalid",
    )
    expect(mocks.requireAuthenticatedUser).not.toHaveBeenCalled()
  })

  it("maps database authorization errors to a safe public code", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "review_not_allowed: secret database details" },
    })
    mocks.requireAuthenticatedUser.mockResolvedValue({
      supabase: { rpc },
      user: { id: "current-user" },
    })
    const formData = new FormData()
    formData.set("listingId", listingId)
    formData.set("listingSlug", "linen-jacket")
    formData.set("score", "4")

    await expect(upsertListingReviewAction(formData)).rejects.toThrow(
      "REDIRECT:/listing/linen-jacket?review=not-allowed",
    )
    expect(mocks.redirect.mock.calls.at(-1)?.[0]).not.toContain("database")
  })
  it("saves an eligible buyer review from the correct listing conversation", async () => {
    const chatId = "377f3329-6c04-4c40-8f33-873ab3ee4f76"
    const chatQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: chatId }, error: null }),
    }
    const rpc = vi.fn().mockResolvedValue({ data: "review-id", error: null })
    mocks.requireAuthenticatedUser.mockResolvedValue({
      supabase: { rpc, from: vi.fn().mockReturnValue(chatQuery) },
      user: { id: "buyer-user" },
    })
    const formData = new FormData()
    formData.set("listingId", listingId)
    formData.set("listingSlug", "linen-jacket")
    formData.set("chatId", chatId)
    formData.set("score", "5")

    await expect(upsertListingReviewAction(formData)).rejects.toThrow(
      `REDIRECT:/dashboard/chats/${chatId}?review=saved`,
    )
    expect(mocks.requireAuthenticatedUser).toHaveBeenCalledWith(`/dashboard/chats/${chatId}`)
    expect(chatQuery.eq).toHaveBeenCalledWith("buyer_id", "buyer-user")
    expect(chatQuery.eq).toHaveBeenCalledWith("listing_id", listingId)
    expect(rpc).toHaveBeenCalledWith("upsert_listing_review", {
      p_listing_id: listingId,
      p_score: 5,
      p_comment: null,
    })
  })

  it("rejects forged chat or listing combinations without submitting a rating", async () => {
    const chatId = "377f3329-6c04-4c40-8f33-873ab3ee4f76"
    const chatQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    }
    const rpc = vi.fn()
    mocks.requireAuthenticatedUser.mockResolvedValue({
      supabase: { rpc, from: vi.fn().mockReturnValue(chatQuery) },
      user: { id: "not-the-buyer" },
    })
    const formData = new FormData()
    formData.set("listingId", listingId)
    formData.set("listingSlug", "linen-jacket")
    formData.set("chatId", chatId)
    formData.set("score", "5")

    await expect(upsertListingReviewAction(formData)).rejects.toThrow(
      "REDIRECT:/listing/linen-jacket?review=not-allowed",
    )
    expect(rpc).not.toHaveBeenCalled()
  })

})
