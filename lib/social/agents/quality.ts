/**
 * Quality agent — deterministic pre-publication checks.
 * Errors block publishing; warnings are shown to the reviewer.
 * Limits follow Meta's documented constraints (IG caption 2,200 chars, 30 hashtags, carousel 2–10).
 */
import { instagramCompatibleMedia, renderCaption } from "./creative"
import type { ContentType, QualityIssue, QualityReport, SocialPlatform } from "../types"

export type QualityInput = {
  caption: string
  hashtags: string[]
  mediaUrls: string[]
  linkUrl: string | null
  platforms: SocialPlatform[]
  contentType: ContentType
  scheduledFor: string
}

const BLOCKED_CLAIMS = [/გარანტირებულ/u, /100%\s*ორიგინალ/u, /ყველაზე\s+იაფ/u, /guaranteed/i, /original\s+100/i]
const PROFANITY = [/\bfuck/i, /\bshit/i, /ტრაკ/u, /ყლე/u]
const PHONE = /(?:\+?995[\s-]?)?(?:5\d{2}|32)[\s-]?\d{2,3}[\s-]?\d{2}[\s-]?\d{2,3}/
const EMAIL = /[^\s@]+@[^\s@]+\.[a-z]{2,}/i
const URL_IN_TEXT = /https?:\/\/\S+/i
const ALLOWED_MEDIA_HOSTS = [/^samosell\.ge$/, /^www\.samosell\.ge$/, /^[a-z0-9]{20}\.supabase\.co$/]

function mediaHostAllowed(url: string) {
  try {
    const u = new URL(url)
    return u.protocol === "https:" && ALLOWED_MEDIA_HOSTS.some(rule => rule.test(u.hostname))
  } catch { return false }
}

export function checkQuality(input: QualityInput, now = new Date()): QualityReport {
  const issues: QualityIssue[] = []
  const err = (code: string, message: string, platform?: SocialPlatform) => issues.push({ code, severity: "error", message, platform })
  const warn = (code: string, message: string, platform?: SocialPlatform) => issues.push({ code, severity: "warning", message, platform })
  const text = input.caption

  if (text.trim().length < 20) err("caption_too_short", "ტექსტი ძალიან მოკლეა.")
  if (input.platforms.length === 0) err("no_platform", "პლატფორმა არ არის არჩეული.")
  if ((input.platforms as string[]).includes("tiktok")) err("tiktok_disabled", "TikTok გამორთულია პოლიტიკით.")
  if (BLOCKED_CLAIMS.some(r => r.test(text))) err("unverifiable_claim", "შეიცავს გადაუმოწმებელ დაპირებას (მაგ. „გარანტირებული“, „100% ორიგინალი“).")
  if (PROFANITY.some(r => r.test(text))) err("profanity", "შეიცავს შეუსაბამო სიტყვას.")
  if (PHONE.test(text) || EMAIL.test(text)) err("personal_data", "ტექსტში არ უნდა იყოს ტელეფონი ან ელფოსტა.")
  if (URL_IN_TEXT.test(text)) warn("raw_url_in_caption", "ბმული ტექსტში არ არის საჭირო — ის ცალკე ემატება.")
  const georgian = (text.match(/[ა-ჿ]/g) ?? []).length
  const letters = (text.match(/\p{L}/gu) ?? []).length
  if (letters > 0 && georgian / letters < 0.5) warn("not_georgian", "ტექსტის უმეტესობა ქართულად არ არის.")

  if (input.hashtags.length > 30) err("too_many_hashtags", "Instagram-ზე მაქსიმუმ 30 ჰეშთეგია დაშვებული.")
  else if (input.hashtags.length > 12) warn("many_hashtags", "12-ზე მეტი ჰეშთეგი ამცირებს წაკითხვადობას.")
  if (input.hashtags.some(t => !/^[\p{L}\p{N}_]{2,30}$/u.test(t))) err("invalid_hashtag", "ჰეშთეგი შეიცავს დაუშვებელ სიმბოლოს.")

  if (input.linkUrl && !/^https:\/\/(www\.)?samosell\.ge(\/|$)/.test(input.linkUrl)) err("foreign_link", "ბმული მხოლოდ samosell.ge-ზე უნდა იყოს.")
  if (input.mediaUrls.some(u => !mediaHostAllowed(u))) err("media_host", "სურათი უნდა იყოს samosell.ge-დან ან SamoSell-ის Storage-დან (HTTPS).")
  if (input.contentType === "carousel" && (input.mediaUrls.length < 2 || input.mediaUrls.length > 10)) err("carousel_size", "კარუსელს სჭირდება 2–10 სურათი.")
  if (input.contentType === "single_image" && input.mediaUrls.length !== 1) err("single_image_media", "ერთ პოსტს ზუსტად ერთი სურათი სჭირდება.")
  if (input.contentType === "story" && (input.mediaUrls.length !== 1 || !input.mediaUrls.every(instagramCompatibleMedia))) err("story_media", "Story-ს ზუსტად ერთი JPEG სურათი სჭირდება.")

  for (const platform of input.platforms) {
    const rendered = renderCaption(input, platform)
    if (platform === "instagram") {
      if (rendered.length > 2200) err("caption_too_long", "Instagram-ის ტექსტი 2,200 სიმბოლოს აჭარბებს.", platform)
      if (input.mediaUrls.length === 0) err("instagram_media_required", "Instagram-ს სურათი სჭირდება.", platform)
      if (input.mediaUrls.some(u => !instagramCompatibleMedia(u))) err("instagram_requires_jpeg", "Instagram API მხოლოდ JPEG სურათს იღებს.", platform)
    }
    if (platform === "facebook" && rendered.length > 5000) warn("facebook_long", "Facebook-ის ტექსტი ძალიან გრძელია.", platform)
  }

  const at = Date.parse(input.scheduledFor)
  if (!Number.isFinite(at)) err("invalid_schedule", "დაგეგმვის დრო არასწორია.")
  else if (at < now.getTime() - 5 * 60_000) warn("schedule_in_past", "დაგეგმვის დრო უკვე გავიდა — გამოქვეყნდება შემდეგ ციკლზე.")

  const errors = issues.filter(i => i.severity === "error").length
  const warnings = issues.length - errors
  return { passed: errors === 0, score: Math.max(0, 100 - errors * 30 - warnings * 5), issues, checkedAt: now.toISOString() }
}
