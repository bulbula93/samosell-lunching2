// @vitest-environment node
import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

// Next.js regenerates an ISR page at the SHORTEST revalidate window of any cached data it reads.
// A 30-60s data cache silently overrode the homepage's 600s window and burned Vercel CPU/ISR writes.
const PAGE = Number(readFileSync("app/page.tsx", "utf8").match(/export const revalidate = (\d+)/)?.[1])
const HOME_DATA_SOURCES = ["lib/home-page.ts", "lib/public-marketplace-cache.ts", "lib/ad-data.ts", "components/layout/SiteHeader.tsx"]

describe("homepage cache windows", () => {
  it("homepage ISR window is 10 minutes", () => expect(PAGE).toBe(600))
  it.each(HOME_DATA_SOURCES)("%s never caches for less than the homepage window", (file) => {
    const src = readFileSync(file, "utf8")
    const windows = [...src.matchAll(/revalidate:\s*(\d+)/g)].map(m => Number(m[1]))
    expect(windows.length).toBeGreaterThan(0)
    for (const w of windows) expect(w).toBeGreaterThanOrEqual(PAGE)
  })
})
