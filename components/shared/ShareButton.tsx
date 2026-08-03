"use client"

import { useState } from "react"
import { ka } from "@/lib/i18n/ka"

type ShareButtonProps = {
  url: string
  title: string
  text?: string
  className?: string
  compact?: boolean
}

type ShareStatus = "idle" | "sharing" | "copied" | "error"

export default function ShareButton({
  url,
  title,
  text,
  className = "",
  compact = false,
}: ShareButtonProps) {
  const [status, setStatus] = useState<ShareStatus>("idle")
  const label =
    status === "copied"
      ? ka.listingDetail.linkCopied
      : status === "error"
        ? ka.listingDetail.shareFailed
        : ka.listingDetail.share

  function resetStatus() {
    window.setTimeout(() => setStatus("idle"), 1800)
  }

  async function handleClick() {
    if (status === "sharing") return
    setStatus("sharing")

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        setStatus("idle")
        return
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          setStatus("idle")
          return
        }
      }
    }

    try {
      if (!navigator.clipboard?.writeText) {
        setStatus("error")
        resetStatus()
        return
      }

      await navigator.clipboard.writeText(url)
      setStatus("copied")
      resetStatus()
    } catch {
      setStatus("error")
      resetStatus()
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={status === "sharing"}
        className={[
          compact
            ? "rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-text transition hover:bg-surface-alt disabled:cursor-wait disabled:opacity-65"
            : "rounded-xl border border-line bg-white px-5 py-3 text-sm font-semibold text-text transition hover:border-brand/40 hover:bg-brand-soft/40 disabled:cursor-wait disabled:opacity-65",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {label}
      </button>
      <span className="ui-sr-status" role="status" aria-live="polite" aria-atomic="true">
        {status === "copied" || status === "error" ? label : ""}
      </span>
    </>
  )
}
