"use client"

import { useState } from "react"

type SellerPhoneRevealProps = {
  listingId?: string
  sellerUsername?: string
  sellerLabel?: string
  className?: string
}

function toTelHref(phone: string) {
  const trimmed = phone.trim()
  if (!trimmed) return ""
  const hasPlus = trimmed.startsWith("+")
  const digits = trimmed.replace(/\D/g, "")
  if (!digits) return ""
  return `tel:${hasPlus ? "+" : ""}${digits}`
}

export default function SellerPhoneReveal({
  listingId,
  sellerUsername,
  sellerLabel = "გამყიდველი",
  className = "",
}: SellerPhoneRevealProps) {
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const revealPhone = async () => {
    if (loading || phone) return

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/seller-phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          ...(listingId ? { listingId } : {}),
          ...(sellerUsername ? { sellerUsername } : {}),
        }),
      })

      if (!response.ok) {
        throw new Error("phone_unavailable")
      }

      const data = (await response.json()) as { phone?: string }
      const nextPhone = typeof data.phone === "string" ? data.phone.trim() : ""
      if (!nextPhone) throw new Error("phone_unavailable")

      setPhone(nextPhone)
    } catch {
      setError("ნომრის ჩვენება ვერ მოხერხდა. სცადე თავიდან.")
    } finally {
      setLoading(false)
    }
  }

  if (phone) {
    const href = toTelHref(phone)

    return (
      <a
        href={href || undefined}
        className={`flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border border-brand/20 bg-brand-soft/35 px-4 py-3 text-left transition hover:border-brand/40 hover:bg-brand-soft/55 ${className}`}
        aria-label={`${sellerLabel}-სთან დარეკვა: ${phone}`}
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-text-soft">
            ტელეფონი
          </span>
          <span className="mt-1 block break-all text-base font-black text-text">
            {phone}
          </span>
        </span>
        <span className="shrink-0 text-sm font-black text-brand">დარეკვა</span>
      </a>
    )
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={revealPhone}
        disabled={loading}
        className="flex min-h-16 w-full items-center justify-between gap-4 rounded-2xl border border-line bg-surface-alt px-4 py-3 text-left transition hover:border-brand/35 hover:bg-white disabled:cursor-wait disabled:opacity-70"
        aria-label={`${sellerLabel}-ს ტელეფონის ნომრის ნახვა`}
      >
        <span className="min-w-0">
          <span className="block text-[11px] font-bold uppercase tracking-[0.14em] text-text-soft">
            ტელეფონი
          </span>
          <span className="mt-1 block text-sm font-black text-text">
            {loading ? "იტვირთება…" : "ნომრის ნახვა"}
          </span>
        </span>
        <span aria-hidden="true" className="shrink-0 text-lg text-brand">
          ☎
        </span>
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}
