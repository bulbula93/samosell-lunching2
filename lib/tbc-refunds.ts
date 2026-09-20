import "server-only"

import { cancelTbcPayment } from "@/lib/tbc"

export type ProviderRefundRequest = {
  paymentId: string
  amount: number
  currency: "GEL"
}

export type ProviderRefundResult =
  | {
      ok: true
      code: "accepted"
      httpStatus: number
      paymentId: string
    }
  | {
      ok: false
      code: "provider_rejected"
      httpStatus: number
      resultCode: string | null
      classification: "authentication" | "rate_limited" | "provider_unavailable" | "provider_rejected"
      message: string
    }

/**
 * SamoSell currently supports full refunds only. TBC documents the cancel
 * endpoint as POST /payments/{payId}/cancel and requires an amount only for
 * partial cancellation, so this adapter intentionally omits amount from the
 * provider request after validating that our trusted request is a positive GEL
 * amount.
 */
export async function requestProviderRefund(request: ProviderRefundRequest): Promise<ProviderRefundResult> {
  const paymentId = String(request.paymentId ?? "").trim()
  const amount = Number(request.amount)
  if (!paymentId || request.currency !== "GEL" || !Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid trusted TBC refund request")
  }

  const result = await cancelTbcPayment(paymentId)
  if (result.ok) {
    return {
      ok: true,
      code: "accepted",
      httpStatus: result.httpStatus,
      paymentId,
    }
  }

  return {
    ok: false,
    code: "provider_rejected",
    httpStatus: result.httpStatus,
    resultCode: result.resultCode,
    classification: result.classification,
    message: result.detail || `TBC refund request rejected (HTTP ${result.httpStatus})`,
  }
}
