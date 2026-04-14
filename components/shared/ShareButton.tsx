"use client"

import { useMemo, useState } from "react"

type ShareButtonProps = { url: string; title: string; text?: string; className?: string; compact?: boolean }

export default function ShareButton({ url, title, text, className = "", compact = false }: ShareButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle")
  const label = useMemo(() => {
    if (status === "copied") return compact ? "დაკოპირდა" : "ლინკი დაკოპირდა"
    if (status === "error") return compact ? "ვერ დაკოპირდა" : "გაზიარება ვერ შესრულდა"
    return "გაზიარება"
  }, [compact, status])

  async function handleClick() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text, url })
        setStatus("idle")
        return
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return
    }
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
        setStatus("copied")
        window.setTimeout(() => setStatus("idle"), 1800)
        return
      }
      if (typeof window !== "undefined") {
        window.prompt("დააკოპირე ლინკი", url)
        setStatus("copied")
        window.setTimeout(() => setStatus("idle"), 1800)
        return
      }
      setStatus("error")
    } catch {
      setStatus("error")
      window.setTimeout(() => setStatus("idle"), 1800)
    }
  }

  return <button type="button" onClick={handleClick} className={[(compact ? "rounded-xl border border-line bg-white px-4 py-2 text-sm font-semibold text-text transition hover:bg-surface-alt" : "rounded-xl border border-line bg-white px-5 py-3 text-sm font-semibold text-text transition hover:bg-surface-alt"), className].filter(Boolean).join(" ")}>{label}</button>
}
