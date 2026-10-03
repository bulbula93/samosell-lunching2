"use client"

import { useEffect, useState } from "react"

const SHOW_DELAY_MS = 220

export default function DelayedRouteLoader() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="გვერდი იტვირთება"
      className="fixed inset-0 z-[150] flex items-center justify-center bg-[#fffaf6]/78 px-5 backdrop-blur-[3px]"
    >
      <div className="flex min-w-[190px] flex-col items-center rounded-[28px] border border-[#eadfd7] bg-white/95 px-7 py-6 shadow-[0_20px_60px_rgba(7,63,59,0.14)]">
        <img
          src="/brand/samosell-header-logo.svg"
          alt=""
          width={164}
          height={50}
          className="h-[36px] w-auto"
        />

        <div className="mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-[#fff4df]">
          <svg
            aria-hidden="true"
            viewBox="0 0 64 64"
            className="samosell-loader-hanger h-11 w-11 text-brand"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M28 17c0-5 3.5-8 8-8s8 3.5 8 8c0 4-3 6-7 8v5" />
            <path d="M12 43 32 30l20 13" />
            <path d="M12 43h40" />
          </svg>
        </div>

        <p className="mt-4 text-sm font-semibold text-brand">იტვირთება...</p>
      </div>
    </div>
  )
}
