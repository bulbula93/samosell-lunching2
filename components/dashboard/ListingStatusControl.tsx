"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  updateListingStatusAction,
  type UpdateListingStatusResult,
} from "@/app/dashboard/listings/actions"
import {
  getAllowedStatusTransitions,
  listingStatusActionLabel,
  type ListingStatus,
} from "@/lib/my-listings"
import { listingStatusLabel } from "@/lib/listings"

type ListingStatusControlProps = {
  listingId: string
  listingTitle: string
  status: ListingStatus
  updatedAt: string
}

function confirmationMessage(status: ListingStatus, title: string) {
  if (status === "sold") {
    return `ნამდვილად გინდა განცხადების გაყიდულად მონიშვნა?\n\n${title}`
  }
  if (status === "archived") {
    return `ნამდვილად გინდა განცხადების არქივში გადატანა?\n\n${title}\n\nის საჯარო კატალოგიდან დაიმალება.`
  }
  return ""
}

export default function ListingStatusControl({
  listingId,
  listingTitle,
  status,
  updatedAt,
}: ListingStatusControlProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [currentStatus, setCurrentStatus] = useState(status)
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState(updatedAt)
  const [selectedStatus, setSelectedStatus] = useState<ListingStatus>(status)
  const [result, setResult] = useState<UpdateListingStatusResult | null>(null)
  const transitions = getAllowedStatusTransitions(currentStatus)

  if (transitions.length === 0) {
    return (
      <p className="text-xs leading-5 text-text-soft">
        ამ სტატუსის შეცვლა მხოლოდ მოდერაციის პროცესიდან არის შესაძლებელი.
      </p>
    )
  }

  function submitStatus() {
    if (isPending || selectedStatus === currentStatus) return

    const confirmation = confirmationMessage(selectedStatus, listingTitle)
    if (confirmation && !window.confirm(confirmation)) return

    setResult(null)
    startTransition(async () => {
      const actionResult = await updateListingStatusAction({
        listingId,
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
    <div className="w-full" aria-busy={isPending}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor={`status-${listingId}`}>
          სტატუსის ახალი მნიშვნელობა — {listingTitle}
        </label>
        <select
          id={`status-${listingId}`}
          value={selectedStatus}
          disabled={isPending}
          onChange={(event) => {
            setSelectedStatus(event.target.value as ListingStatus)
            setResult(null)
          }}
          className="ui-input min-w-0 flex-1 sm:min-w-48"
        >
          <option value={currentStatus}>მიმდინარე: {listingStatusLabel(currentStatus)}</option>
          {transitions.map((nextStatus) => (
            <option key={nextStatus} value={nextStatus}>
              {listingStatusActionLabel(nextStatus)}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={isPending || selectedStatus === currentStatus}
          onClick={submitStatus}
          className="ui-btn-secondary shrink-0"
        >
          {isPending ? "ინახება…" : "შენახვა"}
        </button>
      </div>

      {isPending ? (
        <p role="status" className="mt-2 text-xs font-medium text-text-soft">
          სტატუსი ახლდება…
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
