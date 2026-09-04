import { describe, expect, it } from "vitest"
import {
  AD_DURATION_MS,
  createSevenDayAdSchedule,
  getAdminAdStatus,
  validateAdminAdInput,
} from "@/lib/admin-ads"

describe("admin ad workflow", () => {
  it("validates allow-listed placement and safe destination", () => {
    expect(validateAdminAdInput({
      advertiserName: "Samo Brand",
      title: "ახალი კოლექცია",
      description: "შეთავაზება",
      placementKey: "home_hero_left",
      targetUrl: "https://example.ge/offer",
      priority: "10",
    })).toEqual({
      ok: true,
      data: {
        advertiserName: "Samo Brand",
        title: "ახალი კოლექცია",
        description: "შეთავაზება",
        placementKey: "home_hero_left",
        targetUrl: "https://example.ge/offer",
        priority: 10,
      },
    })
  })

  it("rejects invented placement keys and unsafe URLs", () => {
    expect(validateAdminAdInput({
      advertiserName: "Brand",
      title: "Offer",
      placementKey: "admin_top",
      targetUrl: "https://example.ge",
      priority: 0,
    })).toEqual({ ok: false, code: "placement" })

    expect(validateAdminAdInput({
      advertiserName: "Brand",
      title: "Offer",
      placementKey: "home_hero_left",
      targetUrl: "javascript:alert(1)",
      priority: 0,
    })).toEqual({ ok: false, code: "target" })
  })

  it("creates an exact seven-day schedule from launch time", () => {
    const now = new Date("2026-09-04T10:00:00.000Z")
    const schedule = createSevenDayAdSchedule(now)
    expect(Date.parse(schedule.endsAt) - Date.parse(schedule.startsAt)).toBe(AD_DURATION_MS)
    expect(schedule.startsAt).toBe(now.toISOString())
  })

  it("classifies draft, active, stopped and expired ads", () => {
    const now = new Date("2026-09-04T10:00:00.000Z")
    expect(getAdminAdStatus({ is_active: false, starts_at: null, ends_at: null }, now)).toBe("draft")
    expect(getAdminAdStatus({ is_active: true, starts_at: "2026-09-04T09:00:00.000Z", ends_at: "2026-09-11T09:00:00.000Z" }, now)).toBe("active")
    expect(getAdminAdStatus({ is_active: false, starts_at: "2026-09-04T09:00:00.000Z", ends_at: "2026-09-11T09:00:00.000Z" }, now)).toBe("stopped")
    expect(getAdminAdStatus({ is_active: true, starts_at: "2026-08-27T09:00:00.000Z", ends_at: "2026-09-03T09:00:00.000Z" }, now)).toBe("expired")
  })
})
