export type ShareCaptionInput = {
  title: string
  priceText?: string | null
  sizeLabel?: string | null
  conditionText?: string | null
  city?: string | null
}

export type ListingCardDescriptionInput = {
  sizeLabel?: string | null
  conditionText?: string | null
  city?: string | null
  brandName?: string | null
}

const clean = (value?: string | null) => String(value ?? "").trim()

/**
 * Builds the text a seller pastes into a Facebook group, a WhatsApp chat or a
 * Telegram channel. Two lines at most: the first carries what a buyer scans for
 * (item, size, price), the second finishes the picture. No trailing punctuation.
 */
export function buildListingShareCaption({
  title,
  priceText,
  sizeLabel,
  conditionText,
  city,
}: ShareCaptionInput): string {
  const headline = [clean(title), clean(sizeLabel), clean(priceText)]
    .filter(Boolean)
    .join(" · ")
  const facts = [clean(conditionText), clean(city)].filter(Boolean).join(" · ")

  return [headline, facts].filter(Boolean).join("\n")
}

/**
 * The description rendered inside the link preview card. Structured facts beat
 * the generic "details, photos and more offers" filler that used to ship on
 * every listing, and the seller's own words follow when they wrote any.
 */
export function buildListingCardDescription(
  { sizeLabel, conditionText, city, brandName }: ListingCardDescriptionInput,
  description: string | null | undefined = "",
  maxLength = 200,
): string {
  const facts = [clean(sizeLabel), clean(conditionText), clean(city), clean(brandName)]
    .filter(Boolean)
    .join(" · ")
  const body = clean(description).replace(/\s+/g, " ")

  if (!facts) return body.slice(0, maxLength)
  if (!body) return facts

  const room = maxLength - facts.length - 3
  if (room < 24) return facts

  const trimmed = body.length > room ? `${body.slice(0, room - 1).trimEnd()}…` : body
  return `${facts} — ${trimmed}`
}

/** The full ready-to-paste post: caption, blank line, link. */
export function buildListingSharePost(caption: string, url: string): string {
  return [clean(caption), clean(url)].filter(Boolean).join("\n\n")
}
