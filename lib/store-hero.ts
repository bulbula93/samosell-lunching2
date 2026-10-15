export type StoreHeroContent = {
  eyebrow: string
  headline: string
  description: string
  coverTitle: string
  coverSubtitle: string
}

export const STORE_HERO_LIMITS: Record<keyof StoreHeroContent, number> = {
  eyebrow: 55,
  headline: 88,
  description: 300,
  coverTitle: 110,
  coverSubtitle: 90,
}

const emptyHero: StoreHeroContent = {
  eyebrow: "",
  headline: "",
  description: "",
  coverTitle: "",
  coverSubtitle: "",
}

export function normalizeStoreHero(input: unknown): StoreHeroContent {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ...emptyHero }
  const values = input as Record<string, unknown>
  const hero = { ...emptyHero }
  for (const field of Object.keys(STORE_HERO_LIMITS) as (keyof StoreHeroContent)[]) {
    const value = values[field]
    hero[field] = typeof value === "string" ? value.trim().slice(0, STORE_HERO_LIMITS[field]) : ""
  }
  return hero
}
