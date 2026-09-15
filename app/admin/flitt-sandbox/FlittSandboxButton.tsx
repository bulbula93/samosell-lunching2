"use client"

import { useState } from "react"

export default function FlittSandboxButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function startCheckout() {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch("/api/payments/flitt/test/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 100 }),
      })
      const payload = await response.json() as { checkoutUrl?: string; error?: string }
      if (!response.ok || !payload.checkoutUrl) throw new Error(payload.error || "checkout_failed")
      window.location.assign(payload.checkoutUrl)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "checkout_failed")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={startCheckout}
        disabled={loading}
        className="rounded-xl bg-emerald-700 px-5 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "იტვირთება…" : "Flitt test გადახდა — 1.00 GEL"}
      </button>
      {error ? <p className="text-sm text-red-700">შეცდომა: {error}</p> : null}
    </div>
  )
}
