import { describe, expect, it } from "vitest"
import { coverColorContrast, createStoreCoverTheme, dominantCoverColor, type CoverRgb } from "@/lib/store-cover-theme"

function pixels(...patches: Array<{ color: CoverRgb; count: number; alpha?: number }>) {
  return Uint8ClampedArray.from(patches.flatMap(patch => Array.from({ length: patch.count }, () => [...patch.color, patch.alpha ?? 255]).flat()))
}

describe("Cover-derived storefront colors", () => {
  it("picks the largest colored area instead of averaging contrasting areas", () => {
    expect(dominantCoverColor(pixels(
      { color: [25, 75, 190], count: 70 },
      { color: [210, 60, 45], count: 30 },
    ))).toEqual([25, 75, 190])
  })

  it("recognizes product color despite a white studio backdrop", () => {
    expect(dominantCoverColor(pixels(
      { color: [255, 255, 255], count: 80 },
      { color: [40, 130, 70], count: 20 },
    ))).toEqual([40, 130, 70])
  })

  it("ignores transparent pixels and insignificant colored specks", () => {
    expect(dominantCoverColor(pixels(
      { color: [255, 0, 0], count: 100, alpha: 0 },
      { color: [130, 130, 130], count: 99 },
      { color: [0, 0, 255], count: 1 },
    ))).toEqual([130, 130, 130])
    expect(dominantCoverColor(new Uint8ClampedArray(16))).toBeNull()
    expect(dominantCoverColor([])).toBeNull()
  })

  it("retains neutral colors for monochrome covers", () => {
    const theme = createStoreCoverTheme([0, 0, 0])
    for (const [red, green, blue] of theme.stops) expect(red === green && green === blue).toBe(true)
    expect(createStoreCoverTheme([255, 255, 255]).backgroundColor).toBe("#ffffff")
  })

  it("keeps at least 4.5:1 text contrast over dark, bright and saturated covers", () => {
    const channels = [0, 64, 128, 192, 255]
    for (const red of channels) for (const green of channels) for (const blue of channels) {
      const theme = createStoreCoverTheme([red, green, blue])
      const accent: CoverRgb = [1, 3, 5].map(index => Number.parseInt(theme.accent.slice(index, index + 2), 16)) as [number, number, number]
      for (const stop of theme.stops) for (const text of [[23, 35, 33], [82, 97, 94], [7, 90, 83], accent] as CoverRgb[]) {
        expect(coverColorContrast(text, stop)).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it("makes visibly distinct warm and cool surfaces", () => {
    const blue = createStoreCoverTheme([20, 70, 210]).stops[2]
    const coral = createStoreCoverTheme([220, 80, 40]).stops[2]
    expect(blue[2] - blue[0]).toBeGreaterThan(20)
    expect(coral[0] - coral[2]).toBeGreaterThan(20)
  })
})
