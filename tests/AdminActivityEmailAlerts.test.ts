import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function source(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8")
}

describe("Admin activity email alerts", () => {
  it("uses the requested initial admin mailbox and idempotent Resend keys", () => {
    const adminEmail = source("lib", "admin-activity-email.ts")
    const email = source("lib", "email.ts")

    expect(adminEmail).toContain('DEFAULT_ADMIN_ACTIVITY_EMAIL = "giorgi.bulbula@gmail.com"')
    expect(adminEmail).toContain("ADMIN_ACTIVITY_EMAIL")
    expect(email).toContain('"Idempotency-Key"')
    expect(email).toContain("input.idempotencyKey")
  })

  it("alerts on a new published listing from both listing publication paths", () => {
    const formActions = source("app", "dashboard", "listings", "form-actions.ts")
    const statusActions = source("app", "dashboard", "listings", "actions.ts")

    expect(formActions).toContain("notifyAdminNewListing")
    expect(formActions).toContain("firstPublication")
    expect(statusActions).toContain("notifyAdminNewListing")
    expect(statusActions).toContain("!ownedListing.published_at")
  })

  it("alerts on a new self-service ad request", () => {
    const advertise = source("app", "advertise", "actions.ts")

    expect(advertise).toContain("notifyAdminNewAd")
    expect(advertise).toContain("advertiserName: validation.data.advertiserName")
    expect(advertise).toContain("userEmail: user.email")
  })

  it("alerts once a paid boost package is actually activated", () => {
    const flitt = source("lib", "flitt-boost.ts")
    const tbc = source("lib", "tbc-sync.ts")
    const adminEmail = source("lib", "admin-activity-email.ts")

    expect(flitt).toContain("if (result.activated)")
    expect(flitt).toContain('notifyAdminBoostPurchase(safeOrderId, "Flitt")')
    expect(tbc).toContain('applied.outcome === "applied" && applied.activated')
    expect(tbc).toContain('notifyAdminBoostPurchase(claim.id, "TBC")')
    expect(adminEmail).toContain("admin-boost-purchased-")
  })
})
