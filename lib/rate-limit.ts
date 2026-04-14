import type { SupabaseClient } from "@supabase/supabase-js"

const ACTION_RULES = {
  listing_create: {
    windowSeconds: 60 * 60,
    maxHits: 12,
    label: "განცხადებების შექმნა",
  },
  chat_start: {
    windowSeconds: 10 * 60,
    maxHits: 20,
    label: "ახალი ჩატის დაწყება",
  },
  listing_report: {
    windowSeconds: 60 * 60,
    maxHits: 10,
    label: "რეპორტების გაგზავნა",
  },
} as const

type RateLimitAction = keyof typeof ACTION_RULES

type RateLimitResult = {
  allowed: boolean
  current_count: number
  limit_count: number
  retry_after_seconds: number
}

function formatRetry(seconds: number) {
  if (seconds <= 0) return "რამდენიმე წამში"
  if (seconds < 60) return `${seconds} წამში`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `${minutes} წუთში`
  const hours = Math.ceil(minutes / 60)
  return `${hours} საათში`
}

export async function enforceRateLimit(supabase: SupabaseClient, action: RateLimitAction) {
  const rule = ACTION_RULES[action]
  const { data, error } = await supabase
    .rpc("consume_action_rate_limit", {
      p_action: action,
      p_window_seconds: rule.windowSeconds,
      p_max_hits: rule.maxHits,
    })
    .single()

  if (error) {
    if (error.message.includes("consume_action_rate_limit")) {
      throw new Error("rate limiting ჯერ არ არის ჩართული. გაუშვი supabase/11_trust_conversion_hardening.sql და სცადე ხელახლა.")
    }
    throw error
  }

  const payload = data as RateLimitResult | null

  if (!payload?.allowed) {
    throw new Error(`ძალიან ბევრი მოთხოვნა იყო: ${rule.label}. სცადე ხელახლა ${formatRetry(payload?.retry_after_seconds ?? 60)}.`)
  }
}
