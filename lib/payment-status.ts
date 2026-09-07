export const OPEN_REFUND_STATUSES = ["requested", "under_review", "approved", "provider_processing"] as const

export function refundStatusLabel(status?: string | null) {
  switch (status) {
    case "requested": return "მოთხოვნილია"
    case "under_review": return "განხილვაშია"
    case "approved": return "დამტკიცებულია — ბანკის მოქმედებას ელოდება"
    case "rejected": return "უარყოფილია"
    case "provider_processing": return "ბანკში მუშავდება"
    case "refunded": return "დაბრუნებულია"
    case "partially_refunded": return "ნაწილობრივ დაბრუნებულია"
    case "failed": return "დაბრუნება ვერ შესრულდა"
    default: return "მოთხოვნა არ არის"
  }
}

export function isRefundRequestEligible(order: {
  payment_provider?: string | null
  provider_status?: string | null
  paid_at?: string | null
  amount?: number | null
}) {
  return order.payment_provider === "tbc_checkout"
    && order.provider_status === "Succeeded"
    && Boolean(order.paid_at)
    && Number(order.amount) > 0
}

export function paymentOperationalState(order: {
  status?: string | null
  provider_status?: string | null
}) {
  switch (order.provider_status) {
    case "Returned": return "returned"
    case "PartialReturned": return "partially_returned"
    case "Succeeded": return order.status === "active" ? "active" : "succeeded"
    case "Failed": return "failed"
    case "Expired": return "expired"
    case "CancelPaymentProcessing": return "cancelled"
    case "Created":
    case "Processing":
    case "PaymentCompletionProcessing":
    case "WaitingConfirm": return "pending"
    default: return order.status ?? "unknown"
  }
}
