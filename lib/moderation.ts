import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"

export const REPORT_DETAILS_MAX_LENGTH = 2000
export const MODERATION_NOTE_MAX_LENGTH = 2000

export const LISTING_REPORT_REASONS = [
  "spam",
  "fake",
  "prohibited",
  "abuse",
  "wrong_info",
  "other",
] as const

export const USER_REPORT_REASONS = [
  "spam",
  "scam",
  "harassment",
  "impersonation",
  "prohibited",
  "other",
] as const

export const REPORT_STATUSES = [
  "open",
  "reviewing",
  "resolved",
  "dismissed",
] as const

export const MODERATION_DECISIONS = [
  "reviewing",
  "resolved",
  "dismissed",
  "hide_listing",
  "suspend_user",
  "restore_user",
] as const

export type ReportKind = "listing" | "user"
export type ListingReportReason = (typeof LISTING_REPORT_REASONS)[number]
export type UserReportReason = (typeof USER_REPORT_REASONS)[number]
export type ReportStatus = (typeof REPORT_STATUSES)[number]
export type ModerationDecision = (typeof MODERATION_DECISIONS)[number]

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: string) {
  return UUID_PATTERN.test(value)
}

export function isReportStatus(value: string): value is ReportStatus {
  return REPORT_STATUSES.includes(value as ReportStatus)
}

export function isModerationDecision(
  value: string,
): value is ModerationDecision {
  return MODERATION_DECISIONS.includes(value as ModerationDecision)
}

export function validateReportInput(
  kind: ReportKind,
  reason: string,
  details: string,
) {
  const reasons =
    kind === "listing" ? LISTING_REPORT_REASONS : USER_REPORT_REASONS

  if (!(reasons as readonly string[]).includes(reason)) {
    return "აირჩიე რეპორტის სწორი მიზეზი."
  }

  if (details.length > REPORT_DETAILS_MAX_LENGTH) {
    return `დეტალები არ უნდა აღემატებოდეს ${REPORT_DETAILS_MAX_LENGTH} სიმბოლოს.`
  }

  return ""
}

export function reportStatusLabel(value: string) {
  switch (value) {
    case "open":
      return "ღია"
    case "reviewing":
      return "მიმდინარე"
    case "resolved":
      return "მოგვარებული"
    case "dismissed":
      return "უარყოფილი"
    default:
      return value
  }
}

export function reportReasonLabel(kind: ReportKind, value: string) {
  switch (value) {
    case "spam":
      return "სპამი"
    case "fake":
      return "ყალბი განცხადება"
    case "prohibited":
      return kind === "listing" ? "აკრძალული ნივთი" : "აკრძალული ქცევა"
    case "abuse":
      return "შეურაცხმყოფელი შინაარსი"
    case "wrong_info":
      return "არასწორი ინფორმაცია"
    case "scam":
      return "თაღლითობის მცდელობა"
    case "harassment":
      return "შეწუხება ან მუქარა"
    case "impersonation":
      return "სხვის სახელად წარმოდგენა"
    case "other":
      return "სხვა"
    default:
      return value
  }
}

export function moderationErrorMessage(rawMessage: string) {
  const message = rawMessage.toLowerCase()

  if (message.includes("not_authenticated")) return "მოქმედებისთვის ავტორიზაციაა საჭირო."
  if (message.includes("not_authorized")) return "ამ მოქმედების უფლება არ გაქვს."
  if (message.includes("invalid_report_reason")) return "არჩეული რეპორტის მიზეზი არასწორია."
  if (message.includes("report_details_too_long")) return "რეპორტის დეტალები ზედმეტად გრძელია."
  if (message.includes("listing_unavailable")) return "განცხადება აღარ არის ხელმისაწვდომი."
  if (message.includes("user_unavailable")) return "მომხმარებელი აღარ არის ხელმისაწვდომი."
  if (message.includes("self_report")) return "საკუთარი ანგარიშის ან განცხადების დარეპორტება შეუძლებელია."
  if (message.includes("invalid_report_context")) return "რეპორტის კონტექსტი არასწორია."
  if (message.includes("report_rate_limited")) return "ძალიან ბევრი რეპორტი გაიგზავნა. მოგვიანებით სცადე."
  if (message.includes("invalid_block_target")) return "ამ მომხმარებლის დაბლოკვა შეუძლებელია."
  if (message.includes("report_not_found")) return "რეპორტი ვერ მოიძებნა."
  if (message.includes("invalid_report_transition")) return "ამ რეპორტზე არჩეული მოქმედება აღარ არის დაშვებული."
  if (message.includes("invalid_moderation_decision")) return "მოდერაციის მოქმედება არასწორია."
  if (message.includes("moderation_note_too_long")) return "მოდერატორის შენიშვნა ზედმეტად გრძელია."

  return "მოქმედება ვერ შესრულდა. სცადე ხელახლა."
}

export function withSafeFeedback(
  inputPath: string,
  key: string,
  value: string,
  fallback = "/catalog",
) {
  const safePath = getSafeAuthRedirectPath(inputPath, fallback)
  const url = new URL(safePath, "https://samosell.local")
  url.searchParams.set(key, value)
  return `${url.pathname}${url.search}${url.hash}`
}
