import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const route = readFileSync("app/api/push/subscription/route.ts", "utf8")
const rateLimit = readFileSync("lib/rate-limit.ts", "utf8")
const migration = readFileSync(
  "supabase/migrations/20260901090000_rate_limit_push_subscription_writes.sql",
  "utf8",
)

describe("push subscription write boundary", () => {
  it("rate limits authenticated writes with a database-enforced rule", () => {
    expect(route.match(/enforceRateLimit\(supabase, "push_subscription"\)/g)).toHaveLength(2)
    expect(rateLimit).toContain("push_subscription")
    expect(migration).toContain("p_action = 'push_subscription'")
    expect(migration).toContain("p_window_seconds = 600")
    expect(migration).toContain("p_max_hits = 30")
  })

  it("rejects obvious internal and credential-bearing endpoints", () => {
    expect(route).toContain('hostname === "localhost"')
    expect(route).toContain("isIpLiteral")
    expect(route).toContain("!parsed.username")
    expect(route).toContain("!parsed.password")
  })
})
