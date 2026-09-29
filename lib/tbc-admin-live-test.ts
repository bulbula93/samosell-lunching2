import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { getSiteUrlEnv } from "@/lib/env"

const LIVE_TEST_AMOUNT = 1
const LIVE_TEST_CURRENCY = "GEL"
const PAYMENT_ID_PATTERN = /^[A-Za-z0-9_-]{1,160}$/

type TbcPaymentLink = {
  uri?: string | null
  method?: string | null
  rel?: string | null
}

type TbcCreatePaymentResponse = {
  payId?: string
  status?: string
  links?: TbcPaymentLink[] | null
  developerMessage?: string | null
  userMessage?: string | null
  resultCode?: string | null
}

type TbcPaymentDetails = {
  payId?: string
  status?: string
  resultCode?: string | null
  amount?: number
  currency?: string
}

type SyncSource = "callback" | "return" | "manual"

let cachedToken: { value: string; expiresAt: number } | null = null

function readRequired(name: string) {
  const value = String(process.env[name] ?? "").trim()
  if (!value) throw new Error(`აკლია გარემოს ცვლადი: ${name}`)
  return value
}

function parseProviderJson<T>(text: string): T {
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error("TBC returned an invalid JSON response")
  }
}

function getProviderConfig() {
  const siteUrl = getSiteUrlEnv()
  if (siteUrl !== "https://samosell.ge") {
    throw new Error("TBC live test is restricted to the production site URL")
  }

  return {
    apiKey: readRequired("TBC_API_KEY"),
    clientId: readRequired("TBC_CLIENT_ID"),
    clientSecret: readRequired("TBC_CLIENT_SECRET"),
    accessTokenUrl: "https://api.tbcbank.ge/v1/tpay/access-token",
    paymentsUrl: "https://api.tbcbank.ge/v1/tpay/payments",
    siteUrl,
    callbackUrl: `${siteUrl}/api/tbc/checkout/callback`,
  }
}

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value
  }

  const config = getProviderConfig()
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
  })

  const response = await fetch(config.accessTokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      apikey: config.apiKey,
      accept: "application/json",
    },
    body: body.toString(),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`TBC access-token მოთხოვნა ჩავარდა (HTTP ${response.status})`)
  }

  const payload = parseProviderJson<{ access_token?: string }>(text)
  if (!payload.access_token) throw new Error("TBC access-token პასუხი ცარიელია")

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  }

  return payload.access_token
}

function approvalUrl(links?: TbcPaymentLink[] | null) {
  const approval = (links ?? []).find((item) => item.rel === "approval_url" && item.uri)
  if (!approval?.uri) return null

  try {
    const url = new URL(approval.uri)
    if (url.protocol !== "https:" || url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

export function getTbcAdminLiveTestReadiness() {
  const siteUrl = getSiteUrlEnv()
  return {
    apiKeyPresent: Boolean(String(process.env.TBC_API_KEY ?? "").trim()),
    clientIdPresent: Boolean(String(process.env.TBC_CLIENT_ID ?? "").trim()),
    clientSecretPresent: Boolean(String(process.env.TBC_CLIENT_SECRET ?? "").trim()),
    siteUrl,
    siteUrlIsProduction: siteUrl === "https://samosell.ge",
    amount: LIVE_TEST_AMOUNT,
    currency: LIVE_TEST_CURRENCY,
  }
}

export async function createTbcAdminLiveTestPayment(attemptId: string) {
  const config = getProviderConfig()
  const accessToken = await getAccessToken()

  const payload = {
    amount: {
      currency: LIVE_TEST_CURRENCY,
      total: LIVE_TEST_AMOUNT,
    },
    returnurl: `${config.siteUrl}/api/tbc/live-test/return?attempt=${encodeURIComponent(attemptId)}`,
    callbackUrl: config.callbackUrl,
    merchantPaymentId: attemptId,
    language: "KA",
    description: "SamoSell TBC live test",
    extra: "ADMIN LIVE TEST",
    preAuth: false,
    skipInfoMessage: true,
  }

  const response = await fetch(config.paymentsUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      accept: "application/json",
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })

  const text = await response.text()
  if (!response.ok) {
    if (response.status === 401) cachedToken = null
    throw new Error(`TBC live-test payment create ჩავარდა (HTTP ${response.status})`)
  }

  const data = parseProviderJson<TbcCreatePaymentResponse>(text)
  const url = approvalUrl(data.links)
  if (!data.payId || !PAYMENT_ID_PATTERN.test(data.payId) || !url) {
    throw new Error("TBC live-test პასუხში payId ან approval_url ვერ მოიძებნა")
  }

  return { data, approvalUrl: url }
}

export async function getTbcAdminLiveTestPaymentDetails(payId: string) {
  if (!PAYMENT_ID_PATTERN.test(payId)) throw new Error("TBC payment id is invalid")
  const config = getProviderConfig()
  const accessToken = await getAccessToken()

  const response = await fetch(
    `${config.paymentsUrl}/${encodeURIComponent(payId)}`,
    {
      method: "GET",
      headers: {
        accept: "application/json",
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  )

  const text = await response.text()
  if (!response.ok) {
    if (response.status === 401) cachedToken = null
    throw new Error(`TBC live-test payment status ჩავარდა (HTTP ${response.status})`)
  }

  return parseProviderJson<TbcPaymentDetails>(text)
}

export async function cancelTbcAdminLiveTestPayment(payId: string) {
  if (!PAYMENT_ID_PATTERN.test(payId)) throw new Error("TBC payment id is invalid")
  const config = getProviderConfig()
  const accessToken = await getAccessToken()

  const response = await fetch(
    `${config.paymentsUrl}/${encodeURIComponent(payId)}/cancel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accept: "application/json",
        apikey: config.apiKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    },
  )

  if (response.status === 401) cachedToken = null
  if (!response.ok) {
    throw new Error(`TBC live-test refund request ჩავარდა (HTTP ${response.status})`)
  }

  return { ok: true, httpStatus: response.status }
}

function normalizeStatus(status?: string | null) {
  switch (status) {
    case "Succeeded":
      return "succeeded"
    case "Failed":
      return "failed"
    case "Expired":
      return "expired"
    case "CancelPaymentProcessing":
      return "refund_processing"
    case "Returned":
      return "returned"
    case "PartialReturned":
      return "partial_returned"
    case "Created":
    case "Processing":
    case "PaymentCompletionProcessing":
    case "WaitingConfirm":
    default:
      return "checkout_ready"
  }
}

export async function syncTbcAdminLiveTestByPayId(
  payId: string,
  source: SyncSource,
) {
  if (!PAYMENT_ID_PATTERN.test(payId)) {
    return { matched: false as const }
  }

  const admin = createAdminClient()
  const { data: attempt, error } = await admin
    .from("tbc_live_test_attempts")
    .select("id, provider_payment_id")
    .eq("provider_payment_id", payId)
    .maybeSingle()

  if (error) throw error
  if (!attempt) return { matched: false as const }

  const payment = await getTbcAdminLiveTestPaymentDetails(payId)
  const now = new Date().toISOString()

  if (payment.payId && payment.payId !== payId) {
    await admin
      .from("tbc_live_test_attempts")
      .update({
        status: "verification_failed",
        failure_reason: "TBC payment identity mismatch.",
        last_synced_at: now,
        updated_at: now,
      })
      .eq("id", attempt.id)
    throw new Error("TBC live-test payment identity mismatch")
  }

  const amountIsValid =
    payment.amount == null || Number(payment.amount) === LIVE_TEST_AMOUNT
  const currencyIsValid =
    payment.currency == null || payment.currency === LIVE_TEST_CURRENCY

  if (!amountIsValid || !currencyIsValid) {
    await admin
      .from("tbc_live_test_attempts")
      .update({
        status: "verification_failed",
        provider_status: payment.status ?? null,
        provider_result_code: payment.resultCode ?? null,
        failure_reason: "TBC live-test amount or currency mismatch.",
        last_synced_at: now,
        callback_received_at: source === "callback" ? now : undefined,
        updated_at: now,
      })
      .eq("id", attempt.id)
    throw new Error("TBC live-test amount or currency mismatch")
  }

  const nextStatus = normalizeStatus(payment.status)
  const update: Record<string, string | null> = {
    status: nextStatus,
    provider_status: payment.status ?? null,
    provider_result_code: payment.resultCode ?? null,
    failure_reason: null,
    last_synced_at: now,
    updated_at: now,
  }

  if (source === "callback") update.callback_received_at = now
  if (payment.status === "Succeeded") update.paid_at = now
  if (payment.status === "Returned" || payment.status === "PartialReturned") {
    update.refunded_at = now
  }

  const { error: updateError } = await admin
    .from("tbc_live_test_attempts")
    .update(update)
    .eq("id", attempt.id)

  if (updateError) throw updateError

  return {
    matched: true as const,
    attemptId: String(attempt.id),
    providerStatus: payment.status ?? null,
    status: nextStatus,
  }
}

export async function syncTbcAdminLiveTestByAttemptId(attemptId: string) {
  const admin = createAdminClient()
  const { data: attempt, error } = await admin
    .from("tbc_live_test_attempts")
    .select("id, provider_payment_id")
    .eq("id", attemptId)
    .maybeSingle()

  if (error) throw error
  if (!attempt?.provider_payment_id) {
    throw new Error("TBC live-test payment id ჯერ არ არსებობს")
  }

  return syncTbcAdminLiveTestByPayId(
    String(attempt.provider_payment_id),
    "manual",
  )
}
