import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const source = readFileSync("app/stores/page.tsx", "utf8")

describe("stores page public cleanup", () => {
  it("does not link ordinary visitors to the design demo", () => {
    expect(source).not.toContain('href="/stores?demo=1"')
    expect(source).not.toContain('demo ? "/stores" : "/stores?demo=1"')
    expect(source).not.toContain("დემოს ნახვა")
  })

  it("renders the VIP section only when there are VIP listings", () => {
    expect(source).toContain("{displayVipListings.length > 0 ? (")
    expect(source).not.toContain("მაღაზიების VIP განცხადებები მალე გამოჩნდება")
  })

  it("does not force a tall hero on phones", () => {
    expect(source).not.toMatch(/className="relative grid min-h-\[550px\]/)
    expect(source).toContain("lg:min-h-[550px]")
  })

  it("uses the store's own initial instead of a fixed letter", () => {
    expect(source).toContain("storeInitial(store)")
  })
})
