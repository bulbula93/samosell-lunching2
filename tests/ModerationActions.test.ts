import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  reviewModerationReportAction,
  submitListingReportAction,
  submitUserReportAction,
  toggleBlockUserAction,
} from "@/app/moderation/actions"

const mocks = vi.hoisted(() => ({
  requireAuthenticatedUser: vi.fn(),
  requireAdminUser: vi.fn(),
  redirect: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/auth", () => ({
  requireAuthenticatedUser: mocks.requireAuthenticatedUser,
  requireAdminUser: mocks.requireAdminUser,
}))

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

const listingId = "277f3329-6c04-4c40-8f33-873ab3ee4f76"
const sellerId = "377f3329-6c04-4c40-8f33-873ab3ee4f76"
const reportId = "477f3329-6c04-4c40-8f33-873ab3ee4f76"

describe("moderation server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.redirect.mockImplementation((path: string) => {
      throw new Error(`REDIRECT:${path}`)
    })
  })

  it("submits a listing report without trusting forged seller or reporter ids", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: reportId, error: null })
    mocks.requireAuthenticatedUser.mockResolvedValue({
      supabase: { rpc },
      user: { id: "current-user" },
    })
    const formData = new FormData()
    formData.set("listingId", listingId)
    formData.set("listingSlug", "linen-jacket")
    formData.set("reason", "fake")
    formData.set("details", "  ფოტო არ ემთხვევა აღწერას  ")
    formData.set("nextPath", "/listing/linen-jacket")
    formData.set("sellerId", "forged-seller")
    formData.set("reporterId", "forged-reporter")

    await expect(submitListingReportAction(formData)).rejects.toThrow(
      "REDIRECT:/listing/linen-jacket?report=ok",
    )

    expect(rpc).toHaveBeenCalledWith("submit_listing_report", {
      p_listing_id: listingId,
      p_reason: "fake",
      p_details: "ფოტო არ ემთხვევა აღწერას",
    })
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("sellerId")
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("reporterId")
  })

  it("rejects an invalid reason before authentication or database access", async () => {
    const formData = new FormData()
    formData.set("listingId", listingId)
    formData.set("listingSlug", "linen-jacket")
    formData.set("reason", "make_me_admin")
    formData.set("nextPath", "//evil.example")

    await expect(submitListingReportAction(formData)).rejects.toThrow(
      /^REDIRECT:\/listing\/linen-jacket\?report=/,
    )
    expect(mocks.requireAuthenticatedUser).not.toHaveBeenCalled()
  })

  it("submits a user report with only a validated target and listing context", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: reportId, error: null })
    mocks.requireAuthenticatedUser.mockResolvedValue({
      supabase: { rpc },
      user: { id: "current-user" },
    })
    const formData = new FormData()
    formData.set("reportedUserId", sellerId)
    formData.set("contextListingId", listingId)
    formData.set("reason", "scam")
    formData.set("details", "საეჭვო მოთხოვნა")
    formData.set("nextPath", "/listing/linen-jacket")

    await expect(submitUserReportAction(formData)).rejects.toThrow(
      "REDIRECT:/listing/linen-jacket?report=user-ok",
    )
    expect(rpc).toHaveBeenCalledWith("submit_user_report", {
      p_reported_user_id: sellerId,
      p_reason: "scam",
      p_details: "საეჭვო მოთხოვნა",
      p_context_listing_id: listingId,
    })
  })

  it("sets an explicit block state through the session-scoped RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: true, error: null })
    mocks.requireAuthenticatedUser.mockResolvedValue({
      supabase: { rpc },
      user: { id: "current-user" },
    })
    const formData = new FormData()
    formData.set("blockedId", sellerId)
    formData.set("shouldBlock", "true")
    formData.set("nextPath", "/listing/linen-jacket")
    formData.set("blockerId", "forged-blocker")

    await expect(toggleBlockUserAction(formData)).rejects.toThrow(
      "REDIRECT:/listing/linen-jacket?safety=blocked",
    )
    expect(rpc).toHaveBeenCalledWith("set_user_blocked", {
      p_blocked_id: sellerId,
      p_blocked: true,
    })
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("blockerId")
  })

  it("sends only report identity and a whitelisted decision to the admin RPC", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "resolved", error: null })
    mocks.requireAdminUser.mockResolvedValue({
      supabase: { rpc },
      user: { id: "admin-user" },
    })
    const formData = new FormData()
    formData.set("reportKind", "listing")
    formData.set("reportId", reportId)
    formData.set("decision", "hide_listing")
    formData.set("moderationNote", "წესების დარღვევა")
    formData.set("listingId", "forged-listing")
    formData.set("sellerId", "forged-seller")

    await expect(reviewModerationReportAction(formData)).rejects.toThrow(
      "REDIRECT:/admin/reports?flash=hide_listing",
    )
    expect(rpc).toHaveBeenCalledWith("review_moderation_report", {
      p_report_kind: "listing",
      p_report_id: reportId,
      p_decision: "hide_listing",
      p_moderation_note: "წესების დარღვევა",
    })
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("listingId")
    expect(rpc.mock.calls[0][1]).not.toHaveProperty("sellerId")
  })

  it("does not leak raw database details in user-facing redirects", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: "postgres secret constraint" } })
    mocks.requireAuthenticatedUser.mockResolvedValue({
      supabase: { rpc },
      user: { id: "current-user" },
    })
    const formData = new FormData()
    formData.set("blockedId", sellerId)
    formData.set("shouldBlock", "false")
    formData.set("nextPath", "/catalog")

    await expect(toggleBlockUserAction(formData)).rejects.toThrow(
      "REDIRECT:/catalog?safety=",
    )
    expect(mocks.redirect.mock.calls.at(-1)?.[0]).not.toContain("postgres")
  })
})
