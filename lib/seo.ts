import { getSiteUrlEnv } from "@/lib/env"
import { SITE_DESCRIPTION_EN, SITE_NAME } from "@/lib/site"

export function getSiteUrl() {
  return getSiteUrlEnv().replace(/\/$/, "")
}

export function absoluteUrl(path = "/") {
  if (!path.startsWith("/")) path = `/${path}`
  return `${getSiteUrl()}${path}`
}

export function stripHtml(value?: string | null) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
}

export function truncateDescription(value?: string | null, maxLength = 160) {
  const safe = stripHtml(value)
  if (!safe) return ""
  if (safe.length <= maxLength) return safe
  return `${safe.slice(0, maxLength - 1).trim()}…`
}

export function buildCatalogTitle(page = 1) {
  return page > 1 ? `${SITE_NAME} კატალოგი – გვერდი ${page}` : `${SITE_NAME} კატალოგი`
}

export function buildCatalogDescription(filters: string[] = []) {
  const base = SITE_DESCRIPTION_EN
  if (filters.length === 0) return base
  return `${base} აქტიური ფილტრები: ${filters.join(", ")}.`
}
