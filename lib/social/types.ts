/** Shared types for the Social Media Agent OS. Pure — no runtime dependencies. */
export const SOCIAL_PLATFORMS = ["instagram", "facebook"] as const
export type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number]
/** Every platform the system knows about, including permanently disabled ones. */
export type AnyPlatform = SocialPlatform | "tiktok"

export type ExecutionMode = "dry_run" | "live"
export type RuntimeEnvironment = "production" | "preview" | "development" | "test"

export const PILLARS = ["featured_listing", "giveaway", "how_to_sell", "trust", "category_roundup"] as const
export type Pillar = (typeof PILLARS)[number]
export type ContentType = "single_image" | "carousel" | "text_link" | "story"

export type PostStatus =
  | "draft" | "qa_failed" | "ready_for_review" | "approved" | "scheduled" | "publishing"
  | "published" | "partially_published" | "failed" | "rejected" | "cancelled"

export type JobStatus =
  | "queued" | "leased" | "dry_run_completed" | "published" | "failed" | "dead_letter" | "needs_review" | "cancelled"

export type SocialControl = {
  killSwitch: boolean
  executionMode: ExecutionMode
  instagramEnabled: boolean
  facebookEnabled: boolean
  tiktokEnabled: false
  organicAutoPublish: boolean
  /** Product posts also get a 9:16 Story companion (same approval flow). */
  storiesEnabled: boolean
  approvalMode: "paid"
  dailyAdsBudgetUsd: number
  paidAdsCreateAllowed: false
  paidAdsActivateAllowed: false
  paidAdsSpendModifyAllowed: false
  updatedAt: string
}

export type QualityIssue = { code: string; severity: "error" | "warning"; message: string; platform?: SocialPlatform }
export type QualityReport = { passed: boolean; score: number; issues: QualityIssue[]; checkedAt: string }

export type SocialPost = {
  id: string
  idempotencyKey: string
  status: PostStatus
  pillar: Pillar
  contentType: ContentType
  caption: string
  hashtags: string[]
  mediaUrls: string[]
  linkUrl: string | null
  listingId: string | null
  platforms: SocialPlatform[]
  scheduledFor: string
  version: number
  qualityPassed: boolean
  qualityReport: QualityReport | null
  createdByType: "agent" | "human"
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type SocialApproval = {
  id: string
  postId: string
  postVersion: number
  status: "pending" | "approved" | "rejected" | "expired" | "consumed"
  requestedAt: string
  expiresAt: string
  decidedBy: string | null
  decidedAt: string | null
}

export type PublishJob = {
  id: string
  postId: string
  postVersion: number
  platform: SocialPlatform
  executionMode: ExecutionMode
  idempotencyKey: string
  status: JobStatus
  attempt: number
  maxAttempts: number
  leaseToken: string | null
  leasedUntil: string | null
  scheduledAt: string
  externalContainerId: string | null
  externalPostId: string | null
  lastErrorCode: string | null
}

export type AuditDecision = "allow" | "deny" | "dry_run" | "requires_approval" | "success" | "failure"
export type AuditEntry = {
  actorType: "agent" | "human" | "system"
  actor: string
  action: string
  decision: AuditDecision
  reason: string
  resourceType: string
  resourceId: string | null
  details?: Record<string, string | number | boolean | null>
}
export type StoredAuditEntry = AuditEntry & { id: number; occurredAt: string }

export type MetricRow = {
  postId: string
  platform: SocialPlatform
  metricDate: string
  impressions: number
  reach: number
  likes: number
  comments: number
  shares: number
  saves: number
  linkClicks: number
}

export type AdDraft = {
  id: string
  idempotencyKey: string
  title: string
  objective: "traffic" | "engagement" | "awareness"
  audienceNotes: string
  creativePostId: string | null
  dailyBudgetUsd: 0
  status: "draft" | "archived"
}

/** Public listing data the Strategy/Creative agents may use. No seller PII by design. */
export type CandidateListing = {
  id: string
  slug: string
  title: string
  brand: string | null
  priceGel: number | null
  city: string | null
  category: string | null
  imageUrl: string | null
  isGift: boolean
}
