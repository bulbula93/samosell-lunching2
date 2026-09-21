import "server-only"

import { createHash, timingSafeEqual } from "node:crypto"
import { getPublicEnv, getSiteUrlEnv } from "@/lib/env"

export type FlittMode = "test" | "live"
export type FlittAttemptStatus = "pending" | "approved" | "declined" | "expired" | "reversed" | "failed"

export type FlittAttemptIdentity = {
  orderId: string
  amount: number
  currency: string
  merchantId: string
  providerPaymentId?: string | null
  status: FlittAttemptStatus
}

type FlittCheckoutResponse = {
  response?: {
    checkout_url?: string | null
    payment_id?: string | number | null
    response_status?: string | null
    error_code?: string | number | null
    error_message?: string | null
    signature?: string | null
  }
}

type FlittStatusResponse = {
  response?: Record<string, unknown>
}

function isTrue(value?: string) {
  return String(value ?? "").trim().toLowerCase() === "true"
}

function readRequired(name: string) {
  const value = String(process.env[name] ?? "").trim()
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function readMode(): FlittMode {
  const value = String(process.env.FLITT_MODE ?? "test").trim().toLowerCase()
  if (value !== "test" && value !== "live") throw new Error("FLITT_MODE must be test or live")
  return value
}

function normalizeApiUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== "https:") throw new Error("FLITT_API_URL must use HTTPS")
  return url.toString().replace(/\/$/, "")
}

export function getFlittReadiness() {
  const mode = readMode()
  const featureFlagEnabled = isTrue(process.env.NEXT_PUBLIC_FLITT_PAYMENTS_ENABLED)
  const merchantIdPresent = Boolean(String(process.env.FLITT_MERCHANT_ID ?? "").trim())
  const secretPresent = Boolean(String(process.env.FLITT_SECRET_KEY ?? "").trim())
  const apiUrlPresent = Boolean(String(process.env.FLITT_API_URL ?? "").trim())
  const productionDeployment = String(process.env.VERCEL_ENV ?? "").trim().toLowerCase() === "production"
  const credentialsReady = merchantIdPresent && secretPresent && apiUrlPresent

  return {
    mode,
    featureFlagEnabled,
    merchantIdPresent,
    secretPresent,
    apiUrlPresent,
    productionDeployment,
    sandboxEnabled: mode === "test" && featureFlagEnabled && credentialsReady && !productionDeployment,
    liveEnabled: mode === "live" && featureFlagEnabled && credentialsReady,
  }
}

function readBaseConfig() {
  const readiness = getFlittReadiness()
  const merchantId = readRequired("FLITT_MERCHANT_ID")
  if (!/^\d{1,12}$/.test(merchantId)) throw new Error("FLITT_MERCHANT_ID is invalid")

  const siteUrl = getSiteUrlEnv()
  const publicEnv = getPublicEnv()
  const callbackUrl = readiness.mode === "test"
    ? `${publicEnv.supabaseUrl}/functions/v1/flitt-callback`
    : `${siteUrl}/api/payments/flitt/callback`

  return {
    readiness,
    mode: readiness.mode,
    merchantId,
    secretKey: readRequired("FLITT_SECRET_KEY"),
    apiUrl: normalizeApiUrl(readRequired("FLITT_API_URL")),
    responseUrl: `${siteUrl}/api/payments/flitt/return`,
    callbackUrl,
  }
}

export function getFlittConfig() {
  const config = readBaseConfig()
  if (!config.readiness.sandboxEnabled) throw new Error("Flitt sandbox is disabled")
  if (config.mode !== "test") throw new Error("Flitt live checkout is not enabled")
  return config
}

export function getFlittCheckoutConfig() {
  const config = readBaseConfig()
  if (config.mode === "test") {
    if (!config.readiness.sandboxEnabled) throw new Error("Flitt sandbox checkout is disabled")
    return config
  }
  if (!config.readiness.liveEnabled) throw new Error("Flitt live checkout is disabled")
  return config
}

export function getFlittCallbackConfig() {
  const config = readBaseConfig()
  if (config.mode === "live" && !config.readiness.liveEnabled) {
    throw new Error("Flitt live callbacks are disabled")
  }
  return config
}

function isNonEmpty(value: unknown) {
  return value !== undefined && value !== null && String(value) !== ""
}

export function buildFlittSignature(params: Record<string, unknown>, secretKey: string) {
  const keys = Object.keys(params)
    .filter((key) => key !== "signature" && key !== "response_signature_string" && isNonEmpty(params[key]))
    .sort()
  const values = keys.map((key) => String(params[key]))

  return createHash("sha1").update([secretKey, ...values].join("|"), "utf8").digest("hex")
}

export function verifyFlittSignature(params: Record<string, unknown>, secretKey: string) {
  const provided = String(params.signature ?? "").trim().toLowerCase()
  if (!/^[a-f0-9]{40}$/.test(provided)) return false

  const expected = buildFlittSignature(params, secretKey)
  const left = Buffer.from(provided, "hex")
  const right = Buffer.from(expected, "hex")
  return left.length === right.length && timingSafeEqual(left, right)
}

function safeCheckoutUrl(value: unknown) {
  if (typeof value !== "string") return null
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password) return null
    if (!(url.hostname === "pay.flitt.com" || url.hostname.endsWith(".flitt.com") || url.hostname.endsWith(".flitt.dev"))) return null
    return url.toString()
  } catch {
    return null
  }
}

type FlittCheckoutParams = {
  orderId: string
  amount: number
  currency?: string
  description?: string
}

async function createFlittCheckoutWithConfig(
  params: FlittCheckoutParams,
  config: ReturnType<typeof readBaseConfig>,
) {
  if (!Number.isInteger(params.amount) || params.amount <= 0) throw new Error("Flitt amount must be a positive integer")
  const currency = String(params.currency ?? "GEL").trim().toUpperCase()
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Flitt currency is invalid")

  // Flitt's browser return does not reliably echo order_id. Preserve our own
  // correlation key in the signed response_url so the result page can always
  // reconcile this exact payment attempt server-to-server.
  const responseUrl = new URL(config.responseUrl)
  responseUrl.searchParams.set("order", params.orderId)

  const requestData: Record<string, unknown> = {
    version: "1.0.1",
    order_id: params.orderId,
    currency,
    merchant_id: Number(config.merchantId),
    order_desc: String(params.description ?? "SamoSell payment").trim().slice(0, 1024),
    amount: params.amount,
    response_url: responseUrl.toString(),
    server_callback_url: config.callbackUrl,
    lang: "ka",
  }
  requestData.signature = buildFlittSignature(requestData, config.secretKey)

  const response = await fetch(`${config.apiUrl}/api/checkout/url`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ request: requestData }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })

  const text = await response.text()
  let payload: FlittCheckoutResponse
  try {
    payload = JSON.parse(text) as FlittCheckoutResponse
  } catch {
    throw new Error("Flitt returned an invalid JSON response")
  }

  if (!response.ok || payload.response?.response_status !== "success") {
    const code = payload.response?.error_code ? ` (${String(payload.response.error_code)})` : ""
    throw new Error(`Flitt checkout request failed${code}`)
  }

  const checkoutUrl = safeCheckoutUrl(payload.response.checkout_url)
  const paymentId = payload.response.payment_id === undefined || payload.response.payment_id === null
    ? null
    : String(payload.response.payment_id)

  if (!checkoutUrl || !paymentId) throw new Error("Flitt checkout response is missing checkout_url or payment_id")
  return { checkoutUrl, paymentId }
}

export async function createFlittCheckout(params: FlittCheckoutParams) {
  return createFlittCheckoutWithConfig(params, getFlittCheckoutConfig())
}

export async function createFlittSandboxCheckout(params: FlittCheckoutParams) {
  return createFlittCheckoutWithConfig(params, getFlittConfig())
}

export function mapFlittOrderStatus(value: unknown): FlittAttemptStatus {
  switch (String(value ?? "").trim().toLowerCase()) {
    case "approved": return "approved"
    case "declined": return "declined"
    case "expired": return "expired"
    case "reversed": return "reversed"
    case "created":
    case "processing": return "pending"
    default: return "failed"
  }
}

export function resolveFlittAttemptStatus(current: FlittAttemptStatus, incoming: FlittAttemptStatus) {
  if (current === "reversed") return "reversed"
  if (incoming === "reversed") return "reversed"
  if (current === "approved") return "approved"
  if (["declined", "expired", "failed"].includes(current)) return current
  return incoming
}

export function validateFlittCallback(params: Record<string, unknown>, attempt: FlittAttemptIdentity) {
  const config = getFlittCallbackConfig()
  if (!verifyFlittSignature(params, config.secretKey)) return { ok: false as const, reason: "invalid_signature" }
  if (attempt.merchantId !== config.merchantId) return { ok: false as const, reason: "attempt_merchant_mismatch" }
  if (String(params.merchant_id ?? "") !== config.merchantId) return { ok: false as const, reason: "merchant_mismatch" }
  if (String(params.order_id ?? "") !== attempt.orderId) return { ok: false as const, reason: "order_mismatch" }
  if (String(params.currency ?? "").toUpperCase() !== attempt.currency.toUpperCase()) return { ok: false as const, reason: "currency_mismatch" }
  if (Number(params.amount) !== attempt.amount) return { ok: false as const, reason: "amount_mismatch" }

  const callbackPaymentId = params.payment_id === undefined || params.payment_id === null ? null : String(params.payment_id)
  if (attempt.providerPaymentId && callbackPaymentId !== attempt.providerPaymentId) {
    return { ok: false as const, reason: "payment_id_mismatch" }
  }

  const incomingStatus = mapFlittOrderStatus(params.order_status)
  return {
    ok: true as const,
    paymentId: callbackPaymentId,
    providerStatus: String(params.order_status ?? ""),
    responseStatus: String(params.response_status ?? ""),
    nextStatus: resolveFlittAttemptStatus(attempt.status, incomingStatus),
  }
}

export async function fetchFlittOrderStatus(attempt: FlittAttemptIdentity) {
  const config = getFlittCallbackConfig()
  if (attempt.merchantId !== config.merchantId) throw new Error("Flitt attempt merchant does not match current configuration")

  const requestData: Record<string, unknown> = {
    version: "1.0.1",
    order_id: attempt.orderId,
    merchant_id: Number(config.merchantId),
  }
  requestData.signature = buildFlittSignature(requestData, config.secretKey)

  const response = await fetch(`${config.apiUrl}/api/status/order_id`, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ request: requestData }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })

  const text = await response.text()
  let payload: FlittStatusResponse
  try {
    payload = JSON.parse(text) as FlittStatusResponse
  } catch {
    throw new Error("Flitt status returned invalid JSON")
  }

  const params = payload.response
  if (!response.ok || !params || String(params.response_status ?? "") !== "success") {
    const code = params?.error_code ? ` (${String(params.error_code)})` : ""
    throw new Error(`Flitt status request failed${code}`)
  }

  const validation = validateFlittCallback(params, attempt)
  if (!validation.ok) throw new Error(`Flitt status validation failed: ${validation.reason}`)
  return validation
}
