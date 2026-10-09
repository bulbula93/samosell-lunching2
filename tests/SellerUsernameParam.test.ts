import { describe, expect, it } from "vitest"
import { normalizeSellerUsernameParam } from "@/lib/seller-username"

describe("seller username URL parameters", () => {
  it("keeps an already decoded Georgian username unchanged", () => {
    expect(normalizeSellerUsernameParam("ანა")).toBe("ანა")
  })

  it("decodes a percent-encoded Georgian username before the database query", () => {
    expect(normalizeSellerUsernameParam("%E1%83%90%E1%83%9C%E1%83%90")).toBe("ანა")
  })

  it("does not alter an ASCII username", () => {
    expect(normalizeSellerUsernameParam("modaX")).toBe("modaX")
  })

  it("does not drop significant whitespace from existing usernames", () => {
    expect(normalizeSellerUsernameParam("%E1%83%90%E1%83%9C%E1%83%90%20")).toBe("ანა ")
  })

  it("does not crash for malformed URI escapes", () => {
    expect(normalizeSellerUsernameParam("bad%ZZname")).toBe("bad%ZZname")
  })
})
