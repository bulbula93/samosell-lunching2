import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const route = readFileSync("app/api/tbc/checkout/callback/route.ts", "utf8")

describe("TBC callback boundary", () => {
  it("bounds and validates the provider payload", () => {
    expect(route).toContain("MAX_CALLBACK_BYTES")
    expect(route).toContain("PAYMENT_ID_PATTERN")
    expect(route).toContain('status: 413')
  })

  it("does not return internal exception details to the caller", () => {
    expect(route).toContain('error: "Callback processing failed"')
    expect(route).not.toContain('error: message')
  })
})
