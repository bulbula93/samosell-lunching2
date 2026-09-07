import "server-only"

export type ProviderRefundRequest = {
  paymentId: string
  amount: number
  currency: "GEL"
}

export type ProviderRefundResult = {
  ok: false
  code: "not_configured"
  message: string
}

/**
 * Approval is an internal SamoSell review decision only. A network adapter
 * must not be added until TBC supplies the exact production refund contract.
 */
export async function requestProviderRefund(_request: ProviderRefundRequest): Promise<ProviderRefundResult> {
  void _request
  return {
    ok: false,
    code: "not_configured",
    message: "TBC refund API contract is not configured; provider action must be completed and verified separately.",
  }
}
