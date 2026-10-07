export type Breakdown = { label: string; visitors: number; page_views: number }
export type GrowthSummary = { counts: { visitors: number; sessions: number; page_views: number; registrations: number; listing_starts: number; published_listings: number; sellers: number; purchases: number; revenue: number; paying_sellers: number; banner_purchases: number; publish_failures: number; boosted_published_listings: number }; funnel: number[]; sources: Breakdown[]; campaigns: Breakdown[]; new_sellers: number; registered_publishers: number; favorites_added: number; chats_initiated: number; coverage_since: string | null }
export const ratio = (n: number, d: number) => d > 0 ? `${(n / d * 100).toFixed(1)}%` : "—"
export const average = (n: number, d: number) => d > 0 ? (n / d).toFixed(2) : "—"
