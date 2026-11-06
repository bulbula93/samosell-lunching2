/**
 * Creative agent — builds Georgian captions from reviewed templates.
 * Template-based on purpose: zero cost, no hallucinated prices/claims, fully testable.
 * An LLM writer can be plugged in later behind the same Quality gate.
 */
import type { CandidateListing, ContentType, Pillar, SocialPlatform } from "../types"
import type { PlanSlot } from "./strategy"

export const SITE_ORIGIN = "https://samosell.ge"
/** A real JPEG (Instagram Content Publishing only accepts JPEG). */
export const BRAND_IMAGE_URL = `${SITE_ORIGIN}/brand/samosell-social-brand.jpg`
const BASE_TAGS = ["samosell", "სამოსელი", "მეორადი", "საქართველო"]

export type CreativeDraft = {
  idempotencyKey: string
  pillar: Pillar
  contentType: ContentType
  caption: string
  hashtags: string[]
  mediaUrls: string[]
  linkUrl: string | null
  listingId: string | null
  platforms: SocialPlatform[]
  scheduledFor: string
}

function tag(value: string | null) {
  if (!value) return null
  const cleaned = value.toLocaleLowerCase("ka-GE").replace(/[^\p{L}\p{N}]+/gu, "")
  return cleaned.length >= 2 && cleaned.length <= 30 ? cleaned : null
}

function price(listing: CandidateListing) {
  if (listing.isGift) return "🎁 უფასოდ — გავაჩუქებ"
  if (listing.priceGel === null || !Number.isFinite(listing.priceGel) || listing.priceGel <= 0) return null
  return `💰 ${Math.round(listing.priceGel)} ₾`
}

function listingUrl(listing: CandidateListing) {
  return `${SITE_ORIGIN}/listing/${encodeURIComponent(listing.slug)}?utm_source=social&utm_medium=organic&utm_campaign=agent_os`
}

/** Instagram's content publishing API only accepts JPEG image URLs. */
export function instagramCompatibleMedia(url: string) {
  try { return /\.jpe?g$/i.test(new URL(url).pathname) } catch { return false }
}

/** Drop Instagram for media it would reject instead of failing at publish time. */
function platformsFor(slot: PlanSlot, media: string[]): SocialPlatform[] {
  const ok = media.length > 0 && media.every(instagramCompatibleMedia)
  const platforms = slot.platforms.filter(p => p !== "instagram" || ok)
  return platforms.length ? platforms : slot.platforms
}

function unique(tags: Array<string | null>) {
  return [...new Set(tags.filter((t): t is string => Boolean(t)))].slice(0, 10)
}

export function createDraft(slot: PlanSlot): CreativeDraft {
  const base = { idempotencyKey: slot.slotKey, pillar: slot.pillar, platforms: slot.platforms, scheduledFor: slot.scheduledFor }
  switch (slot.pillar) {
    case "featured_listing":
    case "giveaway": {
      const l = slot.listing
      if (!l || !l.imageUrl) throw new Error("listing_required")
      const lines = [
        slot.pillar === "giveaway" ? "🎁 ვიღაც ამას უფასოდ აჩუქებს!" : "✨ დღის აღმოჩენა SamoSell-ზე",
        "",
        l.title.trim().slice(0, 120),
        l.brand ? `🏷️ ${l.brand}` : null,
        price(l),
        l.city ? `📍 ${l.city}` : null,
        "",
        "ნახე დეტალები და მისწერე გამყიდველს პირდაპირ SamoSell-ზე 👇",
        "🔗 ბმული პროფილშია",
      ].filter((line): line is string => line !== null)
      return {
        ...base,
        contentType: "single_image",
        caption: lines.join("\n"),
        hashtags: unique([...BASE_TAGS, tag(l.brand), tag(l.category), tag(l.city), slot.pillar === "giveaway" ? "გავაჩუქებ" : null]),
        mediaUrls: [l.imageUrl],
        platforms: platformsFor(slot, [l.imageUrl]),
        linkUrl: listingUrl(l),
        listingId: l.id,
      }
    }
    case "category_roundup": {
      const items = slot.listings.filter(l => l.imageUrl)
      if (items.length < 2) throw new Error("listings_required")
      return {
        ...base,
        contentType: "carousel",
        caption: [
          "🛍️ ამ კვირის რჩეული ნივთები SamoSell-ზე",
          "",
          ...items.map((l, i) => `${i + 1}. ${l.title.trim().slice(0, 80)}${price(l) ? ` — ${price(l)}` : ""}`),
          "",
          "გადაფურცლე და აირჩიე შენი ფავორიტი ➡️",
          "🔗 ბმული პროფილშია",
        ].join("\n"),
        hashtags: unique([...BASE_TAGS, ...items.map(l => tag(l.brand))]),
        mediaUrls: items.map(l => l.imageUrl!).slice(0, 10),
        platforms: platformsFor(slot, items.map(l => l.imageUrl!)),
        linkUrl: `${SITE_ORIGIN}/?utm_source=social&utm_medium=organic&utm_campaign=agent_os`,
        listingId: null,
      }
    }
    case "how_to_sell":
      return {
        ...base,
        contentType: "single_image",
        caption: [
          "📸 როგორ გაყიდო ტანსაცმელი სწრაფად?",
          "",
          "1. გადაუღე დღის სინათლეზე",
          "2. მიუთითე ზომა, ბრენდი და მდგომარეობა",
          "3. დააყენე რეალისტური ფასი",
          "",
          "განცხადების დამატება SamoSell-ზე უფასოა და საკომისიოს არ ვიღებთ ✅",
          "🔗 ბმული პროფილშია",
        ].join("\n"),
        hashtags: unique([...BASE_TAGS, "გაყიდე", "რჩევები"]),
        mediaUrls: [BRAND_IMAGE_URL],
        linkUrl: `${SITE_ORIGIN}/sell?utm_source=social&utm_medium=organic&utm_campaign=agent_os`,
        listingId: null,
      }
    case "trust":
      return {
        ...base,
        contentType: "single_image",
        caption: [
          "🤝 რატომ SamoSell?",
          "",
          "• განცხადება — უფასოდ",
          "• საკომისიო — 0%",
          "• პირდაპირი ჩატი გამყიდველთან",
          "• ქალის, კაცის და ბავშვის ტანსაცმელი მთელი საქართველოდან",
          "",
          "🔗 ბმული პროფილშია",
        ].join("\n"),
        hashtags: unique([...BASE_TAGS, "მოდა"]),
        mediaUrls: [BRAND_IMAGE_URL],
        linkUrl: `${SITE_ORIGIN}/?utm_source=social&utm_medium=organic&utm_campaign=agent_os`,
        listingId: null,
      }
  }
}

/** Story companions: products only, published an hour after the feed post for a second touchpoint. */
export const STORY_DELAY_MINUTES = 60
export function storyKey(feedKey: string) { return `${feedKey}:story` }
export function storyPriceLabel(listing: Pick<CandidateListing, "isGift" | "priceGel">) {
  if (listing.isGift) return "უფასოდ"
  if (listing.priceGel === null || !Number.isFinite(listing.priceGel) || listing.priceGel <= 0) return "ფასი შეთანხმებით"
  return `${Math.round(listing.priceGel)} ₾`
}
export function createStoryDraft(feed: { idempotencyKey: string; pillar: Pillar; scheduledFor: string; platforms: SocialPlatform[] }, listing: CandidateListing, storyImageUrl: string): CreativeDraft {
  const at = new Date(Date.parse(feed.scheduledFor) + STORY_DELAY_MINUTES * 60_000).toISOString()
  return {
    idempotencyKey: storyKey(feed.idempotencyKey),
    pillar: feed.pillar,
    contentType: "story",
    // Stories show no caption; this text is only the internal label in the Control Center.
    caption: `Story · ${listing.title.trim().slice(0, 120)}`,
    hashtags: [],
    mediaUrls: [storyImageUrl],
    linkUrl: listingUrl(listing),
    listingId: listing.id,
    platforms: [...feed.platforms],
    scheduledFor: at,
  }
}

/** Platform rendering differs: Instagram captions cannot carry clickable links; Facebook can. */
export function renderCaption(draft: Pick<CreativeDraft, "caption" | "hashtags" | "linkUrl">, platform: SocialPlatform) {
  const tags = draft.hashtags.map(t => `#${t}`).join(" ")
  if (platform === "instagram") return [draft.caption, "", tags].join("\n").trim()
  const caption = draft.caption.replace("🔗 ბმული პროფილშია", draft.linkUrl ? `🔗 ${draft.linkUrl}` : "").trim()
  return [caption, "", tags].join("\n").trim()
}
