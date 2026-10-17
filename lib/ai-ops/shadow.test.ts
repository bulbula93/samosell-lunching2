import { describe, expect, it } from "vitest"
import { isShadowEnabled, triageShadowCounts } from "./shadow"

describe("shadow mode", () => {
  it("is always off in production", () => {
    expect(isShadowEnabled({ VERCEL_ENV: "production", AI_OPS_SHADOW_ENABLED: "true" })).toBe(false)
  })
  it("defaults to disabled and supports emergency stop", () => {
    expect(isShadowEnabled({ VERCEL_ENV: "preview" })).toBe(false)
    expect(isShadowEnabled({ VERCEL_ENV: "preview", AI_OPS_SHADOW_ENABLED: "true", AI_OPS_KILL_SWITCH: "true" })).toBe(false)
    expect(isShadowEnabled({ VERCEL_ENV: "preview", AI_OPS_SHADOW_ENABLED: "true" })).toBe(true)
  })
  it("does not treat unavailable data as zero or invent alerts", () => {
    expect(triageShadowCounts({ moderationOpen: null, supportOpen: 0, paymentsPending: null })).toEqual([])
  })
  it("creates deterministic alerts from aggregate counts", () => {
    expect(triageShadowCounts({ moderationOpen: 11, supportOpen: 2, paymentsPending: 0 })).toMatchObject([
      { role: "moderation", priority: "high", count: 11 },
      { role: "support", priority: "normal", count: 2 },
    ])
  })
})
