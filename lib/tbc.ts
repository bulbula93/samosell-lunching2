import "server-only"

import { getSiteUrlEnv } from "@/lib/env"

export type TbcCreatePaymentParams = {
  orderId: string
  amount: number
  currency: string
  description: string
  extra?: string | null
  userIpAddress?: string | null
  language?: "KA" | "EN"
}

type TbcTokenResponse = {
  access_token: string
}

type TbcPaymentLink = {
  uri?: string | null
  method?: string | null
  rel?: string | null
}

export type TbcCreatePaymentResponse = {
  payId?: string
  status?: string
  links?: TbcPaymentLink[] | null
  developerMessage?: string | null
  userMessage?: string | null
  resultCode?: string | null
}

export type TbcPaymentDetails = {
  payId?: string
  status?: string
  resultCode?: string | null
  amount?: number
  currency?: string
  links?: TbcPaymentLink[] | null
  developerMessage?: string | null
  userMessage?: string | null
}

function readRequired(name: string) {
  const value = String(process.env[name] ?? "").trim()
  if (!value) throw new Error(`აკლია გარემოს ცვლადი: ${name}`)
  return value
}

function isExplicitlyEnabled(value?: string) {
  return String(value ?? "").trim().toLowerCase() === "true"
}

export type TbcCheckoutReadiness = {
  featureFlagEnabled: boolean
  apiKeyPresent: boolean
  clientIdPresent: boolean
  clientSecretPresent: boolean
  siteUrl: string
  siteUrlIsProduction: boolean
  callbackUrl: string
  enabled: boolean
}

function sanitizeTbcDescription(value: string) {
  return value.trim().slice(0, 30)
}

function sanitizeTbcExtra(value?: string | null) {
  if (!value) return undefined
  return value.replace(/[^ -~]/g, "").trim().slice(0, 25) || undefined
}

export function isTbcCheckoutEnabled() {
  const readiness = getTbcCheckoutReadiness()
  return readiness.enabled
}

export function getTbcCheckoutReadiness(): TbcCheckoutReadiness {
  const featureFlagEnabled = isExplicitlyEnabled(process.env.TBC_CHECKOUT_ENABLED)
  const apiKeyPresent = Boolean(String(process.env.TBC_API_KEY ?? "").trim())
  const clientIdPresent = Boolean(String(process.env.TBC_CLIENT_ID ?? "").trim())
  const clientSecretPresent = Boolean(String(process.env.TBC_CLIENT_SECRET ?? "").trim())
  const siteUrl = getSiteUrlEnv()
  const callbackUrl = `${siteUrl}/api/tbc/checkout/callback`

  return {
    featureFlagEnabled,
    apiKeyPresent,
    clientIdPresent,
    clientSecretPresent,
    siteUrl,
    siteUrlIsProduction: siteUrl === "https://samosell.ge",
    callbackUrl,
    enabled: featureFlagEnabled && apiKeyPresent && clientIdPresent && clientSecretPresent,
  }
}

export function getTbcCheckoutConfig() {
  if (!isTbcCheckoutEnabled()) throw new Error("TBC checkout disabled")
  const siteUrl = getSiteUrlEnv()
  return {
    enabled: isTbcCheckoutEnabled(),
    apiKey: readRequired("TBC_API_KEY"),
    clientId: readRequired("TBC_CLIENT_ID"),
    clientSecret: readRequired("TBC_CLIENT_SECRET"),
    accessTokenUrl: "https://api.tbcbank.ge/v1/tpay/access-token",
    paymentsUrl: "https://api.tbcbank.ge/v1/tpay/payments",
    siteUrl,
    callbackUrl: `${siteUrl}/api/tbc/checkout/callback`,
    buildReturnUrl(orderId: string) {
      return `${siteUrl}/api/tbc/boosts/return?order=${encodeURIComponent(orderId)}`
    },
  }
}

let cachedToken: { value: string; expiresAt: number } | null = null

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value

  const config = getTbcCheckoutConfig()
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

  const payload = parseProviderJson<TbcTokenResponse>(text)
  if (!payload.access_token) throw new Error("TBC access-token პასუხი ცარიელია")

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  }

  return payload.access_token
}

function getApprovalUrl(links?: TbcPaymentLink[] | null) {
  const approval = (links ?? []).find((item) => item?.rel === "approval_url" && item.uri)
  if (!approval?.uri) return null
  try {
    const url = new URL(approval.uri)
    return url.protocol === "https:" && !url.username && !url.password ? url.href : null
  } catch { return null }
}

function parseProviderJson<T>(text: string): T {
  try { return JSON.parse(text) as T }
  catch { throw new Error("TBC returned an invalid JSON response") }
}

export async function createTbcPayment(params: TbcCreatePaymentParams) {
  const config = getTbcCheckoutConfig()
  const accessToken = await getAccessToken()

  const payload = {
    amount: {
      currency: params.currency,
      total: Number(params.amount.toFixed(2)),
    },
    returnurl: config.buildReturnUrl(params.orderId),
    callbackUrl: config.callbackUrl,
    merchantPaymentId: params.orderId,
    language: params.language ?? "KA",
    description: sanitizeTbcDescription(params.description),
    extra: sanitizeTbcExtra(params.extra),
    userIpAddress: params.userIpAddress || undefined,
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
    throw new Error(`TBC payment create ჩავარდა (HTTP ${response.status})`)
  }

  const data = parseProviderJson<TbcCreatePaymentResponse>(text)
  const approvalUrl = getApprovalUrl(data.links)
  if (!data.payId || !approvalUrl) {
    throw new Error("TBC payment პასუხში payId ან approval_url ვერ მოიძებნა")
  }

  return { data, approvalUrl }
}

export async function getTbcPaymentDetails(payId: string) {
  const config = getTbcCheckoutConfig()
  const accessToken = await getAccessToken()

  const response = await fetch(`${config.paymentsUrl}/${encodeURIComponent(payId)}`, {
    method: "GET",
    headers: {
      accept: "application/json",
      apikey: config.apiKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  })

  const text = await response.text()
  if (!response.ok) {
    if (response.status === 401) cachedToken = null
    throw new Error(`TBC payment status ჩავარდა (HTTP ${response.status})`)
  }

  return parseProviderJson<TbcPaymentDetails>(text)
}

export function mapTbcStatusToBoostOrderStatus(status?: string | null) {
  switch (status) {
    case "Succeeded":
      return "approved"
    case "WaitingConfirm":
      return "under_review"
    case "Failed":
    case "Expired":
    case "Returned":
    case "PartialReturned":
      return "cancelled"
    case "CancelPaymentProcessing":
      return "cancelled"
    case "Created":
    case "Processing":
    case "PaymentCompletionProcessing":
    default:
      return "pending_payment"
  }
}

export function isTbcFinalStatus(status?: string | null) {
  return ["Succeeded", "Failed", "Expired", "WaitingConfirm", "Returned", "PartialReturned", "CancelPaymentProcessing"].includes(String(status ?? ""))
}

export function canActivateTbcBoost(currentStatus: string, providerStatus?: string | null) {
  return providerStatus === "Succeeded" && ["pending_payment", "under_review", "approved", "active"].includes(currentStatus)
}

export function resolveTbcOrderStatus(currentStatus: string, providerStatus?: string | null) {
  if (providerStatus === "Succeeded") return canActivateTbcBoost(currentStatus, providerStatus) ? (currentStatus === "active" ? "active" : "approved") : currentStatus
  const next = mapTbcStatusToBoostOrderStatus(providerStatus)
  if (next === "cancelled") return "cancelled"
  if (["active", "expired", "rejected", "cancelled"].includes(currentStatus)) return currentStatus
  return next
}

export function classifyTbcHttpFailure(status: number) {
  if (status === 401 || status === 403) return "authentication"
  if (status === 429) return "rate_limited"
  if (status >= 500) return "provider_unavailable"
  return "provider_rejected"
}

export function tbcProviderStatusLabel(status?: string | null) {
  switch (status) {
    case "Created": return "გადახდის სესია შექმნილია"
    case "Processing":
    case "PaymentCompletionProcessing": return "გადახდა მუშავდება"
    case "Succeeded": return "გადახდა წარმატებულია"
    case "WaitingConfirm": return "გადახდა დამატებით შემოწმებას ელოდება"
    case "Failed": return "გადახდა ვერ შესრულდა"
    case "Expired": return "გადახდის სესია ვადაგასულია"
    case "CancelPaymentProcessing": return "გაუქმება მუშავდება"
    case "Returned": return "თანხა დაბრუნებულია"
    case "PartialReturned": return "თანხა ნაწილობრივ დაბრუნებულია"
    default: return status ? `ბანკის სტატუსი: ${status}` : "ბანკის სტატუსი ჯერ უცნობია"
  }
}
