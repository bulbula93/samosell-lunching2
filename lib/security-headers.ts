// Report-only rollout preserves ISR and hydration; no per-request nonce or CSP
// enforcement until browser violations have been reviewed.
export const REPORT_ONLY_CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com https://va.vercel-scripts.com https://vercel.live https://www.googletagmanager.com https://plausible.io",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://accounts.google.com https://vitals.vercel-insights.com https://vercel.live https://*.google-analytics.com https://*.analytics.google.com https://plausible.io",
  "media-src 'self' blob: https://*.supabase.co",
  "worker-src 'self' blob:",
  "frame-src 'self' https://accounts.google.com https://vercel.live",
  "form-action 'self' https://*.supabase.co https://accounts.google.com https://*.flitt.com https://*.fondy.eu https://*.tbcpay.ge https://*.tbcbank.ge",
].join("; ")

export const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=31536000" },
  { key: "Content-Security-Policy-Report-Only", value: REPORT_ONLY_CSP },
]

export function isSameOriginMutation(request: Request) {
  const origin = request.headers.get("origin")
  const site = request.headers.get("sec-fetch-site")
  if (!origin || (site && site !== "same-origin")) return false
  try { return new URL(origin).origin === new URL(request.url).origin }
  catch { return false }
}
