export type CoverRgb = readonly [number, number, number]

export function coverColorContrast(first: CoverRgb, second: CoverRgb) {
  const luminance = (color: CoverRgb) => color.reduce((sum, channel, index) => {
    const value = channel / 255
    return sum + (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][index]
  }, 0)
  const a = luminance(first)
  const b = luminance(second)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

function mix(first: CoverRgb, second: CoverRgb, weight: number): CoverRgb {
  const channel = (index: number) => Math.round(first[index] * (1 - weight) + second[index] * weight)
  return [channel(0), channel(1), channel(2)]
}

function hex(color: CoverRgb) {
  return "#" + color.map(channel => channel.toString(16).padStart(2, "0")).join("")
}

// Quantized votes retain a real image hue instead of averaging unrelated colors
// into brown. Ignore transparent pixels and prefer substantial colored areas to
// the white/black margins common in product photographs.
export function dominantCoverColor(pixels: ArrayLike<number>): CoverRgb | null {
  type Bucket = { weight: number; sums: [number, number, number] }
  const all = new Map<number, Bucket>()
  const colored = new Map<number, Bucket>()
  let totalWeight = 0
  let coloredWeight = 0
  const add = (buckets: Map<number, Bucket>, color: CoverRgb, alpha: number) => {
    const key = ((color[0] >> 5) << 6) | ((color[1] >> 5) << 3) | (color[2] >> 5)
    const bucket = buckets.get(key) ?? { weight: 0, sums: [0, 0, 0] }
    bucket.weight += alpha
    for (let channel = 0; channel < 3; channel++) bucket.sums[channel] += color[channel] * alpha
    buckets.set(key, bucket)
  }
  for (let index = 0; index + 3 < pixels.length; index += 4) {
    if (pixels[index + 3] < 128) continue
    const color: CoverRgb = [pixels[index], pixels[index + 1], pixels[index + 2]]
    const alpha = pixels[index + 3] / 255
    totalWeight += alpha
    add(all, color, alpha)
    const max = Math.max(...color)
    if (max > 30 && (max - Math.min(...color)) / max > 0.16) {
      coloredWeight += alpha
      add(colored, color, alpha)
    }
  }
  const buckets = coloredWeight >= totalWeight * 0.1 ? colored : all
  let winner: Bucket | undefined
  for (const bucket of buckets.values()) {
    if (!winner || bucket.weight > winner.weight) winner = bucket
  }
  return winner ? [
    Math.round(winner.sums[0] / winner.weight),
    Math.round(winner.sums[1] / winner.weight),
    Math.round(winner.sums[2] / winner.weight),
  ] : null
}

export function createStoreCoverTheme(color: CoverRgb) {
  const white: CoverRgb = [255, 255, 255]
  const accent = mix([23, 35, 33], color, 0.3)
  const textColors: CoverRgb[] = [[23, 35, 33], [82, 97, 94], [7, 90, 83], accent]
  const stops = [0.04, 0.12, 0.28].map(initialWeight => {
    let weight = initialWeight
    let tint = mix(white, color, weight)
    while (textColors.some(text => coverColorContrast(text, tint) < 4.6)) {
      weight *= 0.8
      tint = mix(white, color, weight)
    }
    return tint
  })
  return {
    stops,
    backgroundColor: hex(stops[1]),
    backgroundImage: `linear-gradient(115deg,${hex(stops[0])} 0%,${hex(stops[1])} 48%,${hex(stops[2])} 100%)`,
    borderColor: hex(mix(white, color, 0.24)),
    accent: hex(accent),
  }
}

export const DEFAULT_STORE_COVER_THEME = createStoreCoverTheme([186, 126, 82])
