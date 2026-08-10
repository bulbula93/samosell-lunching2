import { describe, expect, it } from "vitest"
import {
  canTransitionMarketplaceOrder,
  getAllowedOrderTransitions,
  getOrdersPath,
  isMarketplaceOrderStatus,
  parseOrderPage,
  parseOrderRoleFilter,
  parseOrderStatusFilter,
} from "@/lib/orders"

describe("marketplace order rules", () => {
  it("accepts only real order statuses and safe filters", () => {
    expect(isMarketplaceOrderStatus("seller_confirmed")).toBe(true)
    expect(isMarketplaceOrderStatus("approved")).toBe(false)
    expect(parseOrderRoleFilter("seller")).toBe("seller")
    expect(parseOrderRoleFilter("buyer_id=attacker")).toBe("all")
    expect(parseOrderStatusFilter("refunded")).toBe("refunded")
    expect(parseOrderStatusFilter("seller_id=attacker")).toBe("all")
    expect(parseOrderPage("3")).toBe(3)
    expect(parseOrderPage("-2")).toBe(1)
  })

  it("allows only role-appropriate participant transitions", () => {
    expect(getAllowedOrderTransitions("paid", "seller")).toEqual(["seller_confirmed"])
    expect(getAllowedOrderTransitions("paid", "buyer")).toEqual(["disputed"])
    expect(getAllowedOrderTransitions("shipped", "buyer")).toEqual(["delivered", "disputed"])
    expect(getAllowedOrderTransitions("shipped", "seller")).toEqual([])
    expect(canTransitionMarketplaceOrder("delivered", "completed", "buyer")).toBe(true)
    expect(canTransitionMarketplaceOrder("pending_payment", "paid", "buyer")).toBe(false)
    expect(canTransitionMarketplaceOrder("disputed", "refunded", "seller")).toBe(false)
  })

  it("builds internal dashboard URLs from allowlisted values", () => {
    expect(getOrdersPath()).toBe("/dashboard/orders")
    expect(getOrdersPath({ role: "buyer", status: "paid", page: 2 })).toBe(
      "/dashboard/orders?role=buyer&status=paid&page=2",
    )
  })
})
