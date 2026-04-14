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

function sanitizeTbcDescription(value: string) {
  return value.trim().slice(0, 30)
}

function sanitizeTbcExtra(value?: string | null) {
  if (!value) return undefined
  return value.replace(/[^ -~]/g, "").trim().slice(0, 25) || undefined
}

export function isTbcCheckoutEnabled() {
  return Boolean(
    String(process.env.TBC_API_KEY ?? "").trim() &&
    String(process.env.TBC_CLIENT_ID ?? "").trim() &&
    String(process.env.TBC_CLIENT_SECRET ?? "").trim()
  )
}

export function getTbcCheckoutConfig() {
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
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`TBC access-token მოთხოვნა ჩავარდა: ${response.status} ${text}`)
  }

  const payload = JSON.parse(text) as TbcTokenResponse
  if (!payload.access_token) throw new Error("TBC access-token პასუხი ცარიელია")

  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  }

  return payload.access_token
}

function getApprovalUrl(links?: TbcPaymentLink[] | null) {
  const approval = (links ?? []).find((item) => item?.rel === "approval_url" && item.uri)
  return approval?.uri ? String(approval.uri) : null
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
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`TBC payment create ჩავარდა: ${response.status} ${text}`)
  }

  const data = JSON.parse(text) as TbcCreatePaymentResponse
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
  })

  const text = await response.text()
  if (!response.ok) {
    throw new Error(`TBC payment status ჩავარდა: ${response.status} ${text}`)
  }

  return JSON.parse(text) as TbcPaymentDetails
}

export function mapTbcStatusToBoostOrderStatus(status?: string | null) {
  switch (status) {
    case "Succeeded":
    case "WaitingConfirm":
      return "approved"
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
  return ["Succeeded", "Failed", "Expired", "WaitingConfirm", "Returned", "PartialReturned"].includes(String(status ?? ""))
}
