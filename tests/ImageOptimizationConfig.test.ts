import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const config = readFileSync("next.config.ts", "utf8")

describe("Vercel image optimization budget", () => {
  it("keeps transformation variants bounded", () => {
    expect(config).toContain('formats: ["image/webp"]')
    expect(config).toContain("minimumCacheTTL: 2_678_400")
    expect(config).toContain("qualities: [75]")
    expect(config).toContain("deviceSizes: [640, 768, 1024, 1280, 1600, 1920, 2048]")
    expect(config).toContain("imageSizes: [24, 32, 48, 64, 96, 128, 256, 384]")
  })

  it("does not re-enable AVIF alongside WebP", () => {
    expect(config).not.toContain('"image/avif"')
  })
})
