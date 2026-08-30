import { getProfileCompletion, type ProfileCompletionInput } from "@/lib/profile-completion"
import type { SellerReviewSummary } from "@/types/review"

export type SellerTrustProfile = ProfileCompletionInput & {
  created_at?: string | null
  is_seller_verified?: boolean | null
}

export type SellerTrustSignalKey =
  | "verified"
  | "phone"
  | "profile"
  | "reviews"
  | "sold"
  | "tenure"

export type SellerTrustSignalTone = "verified" | "positive" | "neutral"

export type SellerTrustSignal = {
  key: SellerTrustSignalKey
  label: string
  detail: string
  tone: SellerTrustSignalTone
}

function normalizeCount(value?: number | null) {
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.floor(Number(value)))
}

export function formatSellerTenure(createdAt?: string | null, now = new Date()) {
  if (!createdAt) return ""
  const created = new Date(createdAt)
  if (Number.isNaN(created.getTime()) || created.getTime() > now.getTime()) return ""

  const totalMonths = Math.max(
    0,
    (now.getUTCFullYear() - created.getUTCFullYear()) * 12
      + (now.getUTCMonth() - created.getUTCMonth()),
  )

  if (totalMonths < 1) return "1 თვეზე ნაკლები"
  if (totalMonths < 12) return `${totalMonths} თვე`

  const years = Math.floor(totalMonths / 12)
  const remainingMonths = totalMonths % 12
  if (remainingMonths === 0) return `${years} წელი`
  return `${years} წელი და ${remainingMonths} თვე`
}

export function getSellerTrustSignals({
  profile,
  soldListingsCount = 0,
  reviewSummary,
  now,
}: {
  profile: SellerTrustProfile
  soldListingsCount?: number | null
  reviewSummary?: SellerReviewSummary | null
  now?: Date
}) {
  const signals: SellerTrustSignal[] = []
  const completion = getProfileCompletion(profile)
  const soldCount = normalizeCount(soldListingsCount)
  const reviewCount = normalizeCount(reviewSummary?.reviewCount)
  const averageScore = Number(reviewSummary?.averageScore)
  const tenure = formatSellerTenure(profile.created_at, now ?? new Date())

  if (profile.is_seller_verified) {
    signals.push({
      key: "verified",
      label: "დადასტურებული პროფილი",
      detail: "SamoSell-ის დადასტურება",
      tone: "verified",
    })
  }

  const phoneItem = completion.items.find((item) => item.key === "phone")
  if (phoneItem?.complete) {
    signals.push({
      key: "phone",
      label: "ტელეფონი მითითებულია",
      detail: "საკონტაქტო ნომერი პროფილშია",
      tone: "positive",
    })
  }

  if (completion.percentage === 100) {
    signals.push({
      key: "profile",
      label: "პროფილი 100% შევსებულია",
      detail: "სახელი, ფოტო, ქალაქი და ტელეფონი",
      tone: "positive",
    })
  }

  if (reviewCount > 0 && Number.isFinite(averageScore)) {
    signals.push({
      key: "reviews",
      label: `★ ${averageScore.toFixed(1)} · ${reviewCount} შეფასება`,
      detail: "გაყიდულად მონიშნული განცხადებების შემდეგ მიღებული შეფასებები",
      tone: "positive",
    })
  }

  if (soldCount > 0) {
    signals.push({
      key: "sold",
      label: `${soldCount} გაყიდულად მონიშნული ნივთი`,
      detail: "გამყიდველის მიერ გაყიდულად მონიშნული განცხადებები",
      tone: "positive",
    })
  }

  if (tenure) {
    signals.push({
      key: "tenure",
      label: `SamoSell-ზე ${tenure}`,
      detail: "ანგარიშის ასაკი",
      tone: "neutral",
    })
  }

  return signals
}
