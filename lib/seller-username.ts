/**
 * Next.js may hand a dynamic seller route a percent-encoded segment.
 * Decode that segment exactly once before matching public.profiles.username.
 *
 * Do not trim: existing profile usernames may include legitimate whitespace.
 */
export function normalizeSellerUsernameParam(username: string): string {
  try {
    return decodeURIComponent(username).normalize("NFC")
  } catch {
    // Malformed escapes should not make the whole route crash.
    return username.normalize("NFC")
  }
}
