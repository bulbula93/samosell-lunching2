import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function read(...parts: string[]) {
  return readFileSync(join(process.cwd(), ...parts), "utf8")
}

describe("Legal operator disclosure", () => {
  it("defines the merchant legal name once", () => {
    expect(read("lib", "site.ts")).toContain(
      'LEGAL_OPERATOR_NAME = "ინდივიდუალური მეწარმე „დაგდაგანი“"',
    )
  })

  it("shows the operator in sitewide and payment/legal surfaces", () => {
    expect(read("components", "layout", "SiteFooter.tsx")).toContain("LEGAL_OPERATOR_NAME")
    expect(read("app", "payment-terms", "page.tsx")).toContain("LEGAL_OPERATOR_NAME")
    expect(read("app", "refund-policy", "page.tsx")).toContain("LEGAL_OPERATOR_NAME")
    expect(read("app", "terms", "page.tsx")).toContain("LEGAL_OPERATOR_NAME")
    expect(read("app", "contact", "page.tsx")).toContain("LEGAL_OPERATOR_NAME")
  })
})
