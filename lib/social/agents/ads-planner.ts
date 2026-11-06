/**
 * Ads Planner — DRAFT ONLY. Produces a structured idea for a future campaign with a $0 budget.
 * There is intentionally no code path in this module (or anywhere in Social OS) that calls the
 * Meta Marketing API to create, activate or change campaigns/ad sets/ads.
 */
import type { AdDraft, SocialPost } from "../types"

export function draftAdPlan(post: Pick<SocialPost, "id" | "pillar" | "caption">): Omit<AdDraft, "id"> {
  const objective: AdDraft["objective"] = post.pillar === "featured_listing" || post.pillar === "category_roundup" ? "traffic" : post.pillar === "giveaway" ? "engagement" : "awareness"
  return {
    idempotencyKey: `ad-draft:${post.id}`,
    title: `${objective === "traffic" ? "ტრაფიკი" : objective === "engagement" ? "ჩართულობა" : "ცნობადობა"} — ${post.caption.split("\n")[0].slice(0, 100)}`,
    objective,
    audienceNotes: "საქართველო, 18–45, ინტერესები: მოდა, მეორადი ტანსაცმელი. მხოლოდ იდეა — გაშვება აკრძალულია პოლიტიკით (ბიუჯეტი $0).",
    creativePostId: post.id,
    dailyBudgetUsd: 0,
    status: "draft",
  }
}
