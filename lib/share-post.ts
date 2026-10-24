export type ShareCaptionInput = {
  title: string
  priceText?: string | null
  sizeLabel?: string | null
  conditionText?: string | null
  city?: string | null
}

const clean = (value?: string | null) => String(value ?? "").trim()

/**
 * Builds the text a seller pastes into a Facebook group, a WhatsApp chat or a
 * Telegram channel. Kept free of trailing punctuation and decorative numbering
 * on purpose, and free of the URL so the platform can append its own.
 */
export function buildListingShareCaption({
  title,
  priceText,
  sizeLabel,
  conditionText,
  city,
}: ShareCaptionInput): string {
  const headline = [clean(title), clean(sizeLabel)].filter(Boolean).join(" · ")
  const facts = [clean(conditionText), clean(city)].filter(Boolean).join(" · ")
  const price = clean(priceText)

  return [headline, price, facts].filter(Boolean).join("\n")
}

/** The full ready-to-paste post: caption, blank line, link. */
export function buildListingSharePost(caption: string, url: string): string {
  return [clean(caption), clean(url)].filter(Boolean).join("\n\n")
}
