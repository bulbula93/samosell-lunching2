"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  transitionMarketplaceOrderAction,
  type TransitionOrderResult,
} from "@/app/dashboard/orders/actions"
import {
  getAllowedOrderTransitions,
  marketplaceOrderActionLabel,
} from "@/lib/orders"
import type { MarketplaceOrderRole, MarketplaceOrderStatus } from "@/types/order"

type OrderStatusControlProps = {
  orderId: string
  listingTitle: string
  role: MarketplaceOrderRole
  status: MarketplaceOrderStatus
  updatedAt: string
}

function confirmationMessage(status: MarketplaceOrderStatus, title: string) {
  if (status === "cancelled") {
    return `ნამდვილად გინდა შეკვეთის გაუქმება?\n\n${title}`
  }
  if (status === "delivered") {
    return `დაადასტურე, რომ ნივთი ნამდვილად მიიღე.\n\n${title}`
  }
  if (status === "completed") {
    return `დაასრულო შეკვეთა? ეს ნიშნავს, რომ მიღებულ ნივთთან პრობლემა არ გაქვს.\n\n${title}`
  }
  if (status === "disputed") {
    return `დავის გახსნა შეკვეთას შეაჩერებს შემდგომ განხილვამდე. გააგრძელო?\n\n${title}`
  }
  return ""
}

export default function OrderStatusControl({
  orderId,
  listingTitle,
  role,
  status,
  updatedAt,
}: OrderStatusControlProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStatus, setCurrentStatus] = useState(status)
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState(updatedAt)
  const [selectedStatus, setSelectedStatus] = useState<MarketplaceOrderStatus>(status)
  const [result, setResult] = useState<TransitionOrderResult | null>(null)
  const transitions = getAllowedOrderTransitions(currentStatus, role)

  if (transitions.length === 0) return null

  function submitStatus() {
    if (isPending || selectedStatus === currentStatus) return
    const confirmation = confirmationMessage(selectedStatus, listingTitle)
    if (confirmation && !window.confirm(confirmation)) return

    setResult(null)
    startTransition(async () => {
      const actionResult = await transitionMarketplaceOrderAction({
        orderId,
        nextStatus: selectedStatus,
        expectedUpdatedAt: currentUpdatedAt,
      })
      setResult(actionResult)

      if (actionResult.ok) {
        setCurrentStatus(actionResult.status)
        setSelectedStatus(actionResult.status)
        setCurrentUpdatedAt(actionResult.updatedAt)
        router.refresh()
      }
    })
  }

  return (
    <div aria-busy={isPending} className="w-full border-t border-line pt-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`order-status-${orderId}`}>
          შეკვეთის შემდეგი მოქმედება — {listingTitle}
        </label>
        <select
          id={`order-status-${orderId}`}
          value={selectedStatus}
          disabled={isPending}
          onChange={(event) => {
            setSelectedStatus(event.target.value as MarketplaceOrderStatus)
            setResult(null)
          }}
          className="ui-input min-w-0 flex-1 sm:min-w-56"
        >
          <option value={currentStatus}>აირჩიე მოქმედება</option>
          {transitions.map((nextStatus) => (
            <option key={nextStatus} value={nextStatus}>
              {marketplaceOrderActionLabel(nextStatus)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending || selectedStatus === currentStatus}
          onClick={submitStatus}
          className="ui-btn-secondary shrink-0"
        >
          {isPending ? "ინახება…" : "დადასტურება"}
        </button>
      </div>

      {isPending ? (
        <p role="status" className="mt-2 text-xs font-medium text-text-soft">
          შეკვეთის სტატუსი ახლდება…
        </p>
      ) : null}
      {result ? (
        <p
          role={result.ok ? "status" : "alert"}
          className={`mt-2 text-xs font-semibold ${result.ok ? "text-emerald-700" : "text-red-700"}`}
        >
          {result.message}
        </p>
      ) : null}
    </div>
  )
}
