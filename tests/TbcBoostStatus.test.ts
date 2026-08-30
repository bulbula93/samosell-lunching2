import { describe, expect, it } from "vitest"
import { isTbcFinalStatus, mapTbcStatusToBoostOrderStatus } from "@/lib/tbc"

describe("TBC boost status mapping", () => {
  it("activates only Succeeded and sends preauthorization-only WaitingConfirm to review", () => {
    expect(mapTbcStatusToBoostOrderStatus("Succeeded")).toBe("approved")
    expect(mapTbcStatusToBoostOrderStatus("WaitingConfirm")).toBe("under_review")
  })

  it.each(["Failed", "Expired", "Returned", "PartialReturned", "CancelPaymentProcessing"])(
    "maps %s to cancelled",
    (status) => expect(mapTbcStatusToBoostOrderStatus(status)).toBe("cancelled"),
  )

  it.each(["Created", "Processing", "PaymentCompletionProcessing"])(
    "keeps %s pending",
    (status) => expect(mapTbcStatusToBoostOrderStatus(status)).toBe("pending_payment"),
  )

  it("recognizes all terminal provider statuses", () => {
    for (const status of ["Succeeded", "Failed", "Expired", "WaitingConfirm", "Returned", "PartialReturned", "CancelPaymentProcessing"]) {
      expect(isTbcFinalStatus(status)).toBe(true)
    }
  })
})
