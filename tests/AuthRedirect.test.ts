import { describe, expect, it } from "vitest"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"

describe("safe authentication return paths", () => {
  it("keeps internal create and edit destinations", () => {
    expect(getSafeAuthRedirectPath("/dashboard/listings/new")).toBe("/dashboard/listings/new")
    expect(
      getSafeAuthRedirectPath("/dashboard/listings/177f3329-6c04-4c40-8f33-873ab3ee4f76/edit?tab=photos")
    ).toContain("/dashboard/listings/")
  })

  it.each([
    "https://evil.example/steal",
    "//evil.example/steal",
    "/\\evil.example/steal",
    "javascript:alert(1)",
  ])("rejects unsafe redirect %s", (value) => {
    expect(getSafeAuthRedirectPath(value, "/dashboard")).toBe("/dashboard")
  })
})
