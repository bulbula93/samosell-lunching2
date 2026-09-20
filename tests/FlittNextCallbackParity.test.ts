import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

describe("Flitt Next callback lifecycle parity", () => {
  const callback = read("app/api/payments/flitt/callback/route.ts")
  const boostBridge = read("lib/flitt-boost.ts")

  it("retries idempotent finalization after every authoritative approval", () => {
    expect(callback).toContain("independentlyApproved")
    expect(callback).toContain("await finalizeFlittBoostPayment(attempt.boost_order_id)")
    expect(callback).not.toContain("!alreadyProviderVerified")
  })

  it("reconciles authoritative reversals through the service-role-only database RPC", () => {
    expect(callback).toContain("independentlyReversed")
    expect(callback).toContain("await reverseFlittBoostPayment(attempt.boost_order_id)")
    expect(boostBridge).toContain('.rpc("reverse_flitt_boost_payment"')
  })
})
