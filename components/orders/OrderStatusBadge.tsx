import { marketplaceOrderStatusLabel, orderStatusClasses } from "@/lib/orders"
import type { MarketplaceOrderStatus } from "@/types/order"

export default function OrderStatusBadge({ status }: { status: MarketplaceOrderStatus }) {
  return (
    <span
      className={`inline-flex min-h-8 items-center rounded-full border px-3 py-1.5 text-xs font-bold ${orderStatusClasses(status)}`}
    >
      <span aria-hidden="true" className="mr-1.5">●</span>
      {marketplaceOrderStatusLabel(status)}
    </span>
  )
}
