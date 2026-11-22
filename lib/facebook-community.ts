/** Only direct Facebook group URLs; never redirects, profiles, posts or lookalike hosts. */
export function normalizeFacebookGroupUrl(input: unknown): string | null {
  if (typeof input !== "string" || input.length > 500 || /[\u0000-\u0020\\]/.test(input.trim())) return null
  try {
    const url = new URL(input.trim())
    if (url.protocol !== "https:" || !["facebook.com", "www.facebook.com", "m.facebook.com"].includes(url.hostname) || url.username || url.password || url.port) return null
    const match = /^\/groups\/([A-Za-z0-9._-]{1,200})\/?$/.exec(url.pathname)
    return match ? `https://www.facebook.com/groups/${match[1]}/` : null
  } catch { return null }
}

export const LISTING_SHARE_ACTIONS = ["facebook_share_clicked", "post_copied", "link_copied", "group_open_clicked"] as const
export type ListingShareAction = typeof LISTING_SHARE_ACTIONS[number]
export function isListingShareAction(value: unknown): value is ListingShareAction {
  return LISTING_SHARE_ACTIONS.includes(value as ListingShareAction)
}
