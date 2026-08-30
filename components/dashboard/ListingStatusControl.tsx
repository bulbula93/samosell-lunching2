"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import {
  getListingBuyerCandidatesAction,
  updateListingStatusAction,
  type ListingBuyerCandidate,
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
  const [buyerPickerOpen, setBuyerPickerOpen] = useState(false)
  const [buyerLoading, setBuyerLoading] = useState(false)
  const [buyerLoadError, setBuyerLoadError] = useState("")
  const [buyerCandidates, setBuyerCandidates] = useState<ListingBuyerCandidate[]>([])
  const [selectedBuyerId, setSelectedBuyerId] = useState("")
  const transitions = getAllowedStatusTransitions(currentStatus)

  if (transitions.length === 0) {
    return (
      <p className="text-xs leading-5 text-text-soft">
        ამ სტატუსის შეცვლა მხოლოდ მოდერაციის პროცესიდან არის შესაძლებელი.
      </p>
    )
  }

  function applyStatus(nextStatus: ListingStatus, soldToUserId?: string) {
    if (isPending || nextStatus === currentStatus) return

    setResult(null)
    startTransition(async () => {
      const actionResult = await updateListingStatusAction({
        listingId,
        nextStatus,
        expectedUpdatedAt: currentUpdatedAt,
        soldToUserId: soldToUserId ?? null,
      })
      setResult(actionResult)

      if (actionResult.ok) {
        setCurrentStatus(actionResult.status)
        setSelectedStatus(actionResult.status)
        setCurrentUpdatedAt(actionResult.updatedAt)
        setBuyerPickerOpen(false)
        setSelectedBuyerId("")
        router.refresh()
      }
    })
  }

  async function openBuyerPicker() {
    if (buyerLoading || isPending) return

    setBuyerPickerOpen(true)
    setBuyerLoading(true)
    setBuyerLoadError("")
    setBuyerCandidates([])
    setSelectedBuyerId("")
    setResult(null)

    const candidateResult = await getListingBuyerCandidatesAction(listingId)
    setBuyerLoading(false)

    if (!candidateResult.ok) {
      setBuyerLoadError(candidateResult.message)
      return
    }

    setBuyerCandidates(candidateResult.candidates)
    if (candidateResult.candidates.length === 1) {
      setSelectedBuyerId(candidateResult.candidates[0].id)
    }
  }

  function submitStatus() {
    if (isPending || selectedStatus === currentStatus) return

    if (selectedStatus === "sold") {
      void openBuyerPicker()
      return
    }

    const confirmation = confirmationMessage(selectedStatus, listingTitle)
    if (confirmation && !window.confirm(confirmation)) return
    applyStatus(selectedStatus)
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

      {buyerPickerOpen ? (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={`sold-buyer-title-${listingId}`}
        >
          <div className="w-full max-w-lg rounded-2xl border border-line bg-white p-5 shadow-xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">გაყიდვის დასრულება</p>
                <h3 id={`sold-buyer-title-${listingId}`} className="mt-2 text-xl font-black text-text">
                  ვის მიჰყიდე?
                </h3>
                <p className="mt-2 text-sm leading-6 text-text-soft">
                  აირჩიე მხოლოდ ის მომხმარებელი, რომელმაც ამ ნივთზე მოგწერა. შეფასების დატოვება მხოლოდ არჩეულ მყიდველს შეეძლება.
                </p>
              </div>
              <button
                type="button"
                aria-label="დახურვა"
                disabled={isPending}
                onClick={() => setBuyerPickerOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-white text-lg text-text-soft transition hover:border-brand hover:text-brand"
              >
                ×
              </button>
            </div>

            {buyerLoading ? (
              <p role="status" className="mt-5 rounded-xl bg-surface-alt px-4 py-4 text-sm text-text-soft">
                მყიდველების სია იტვირთება…
              </p>
            ) : buyerLoadError ? (
              <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
                {buyerLoadError}
              </p>
            ) : buyerCandidates.length === 0 ? (
              <div className="mt-5 rounded-xl border border-line bg-surface-alt px-4 py-4">
                <p className="text-sm font-bold text-text">მყიდველი ჯერ არ არის</p>
                <p className="mt-1 text-sm leading-6 text-text-soft">
                  ამ ნივთზე ჯერ არ არის მომხმარებელი, რომელმაც ჩატში მოგწერა. ასეთ შემთხვევაში განცხადებას გაყიდულად ვერ მონიშნავ.
                </p>
              </div>
            ) : (
              <fieldset className="mt-5">
                <legend className="sr-only">აირჩიე მყიდველი</legend>
                <div className="grid gap-2">
                  {buyerCandidates.map((candidate) => (
                    <label
                      key={candidate.id}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 transition ${
                        selectedBuyerId === candidate.id
                          ? "border-brand bg-brand-soft/60"
                          : "border-line bg-white hover:border-brand/50"
                      }`}
                    >
                      <input
                        type="radio"
                        name={`sold-buyer-${listingId}`}
                        value={candidate.id}
                        checked={selectedBuyerId === candidate.id}
                        onChange={() => setSelectedBuyerId(candidate.id)}
                        className="h-4 w-4 accent-[var(--color-brand)]"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-text">{candidate.label}</span>
                        {candidate.username && candidate.label !== `@${candidate.username}` ? (
                          <span className="mt-0.5 block truncate text-xs text-text-soft">@{candidate.username}</span>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                disabled={isPending}
                onClick={() => setBuyerPickerOpen(false)}
                className="ui-btn-secondary"
              >
                გაუქმება
              </button>
              <button
                type="button"
                disabled={buyerLoading || isPending || !selectedBuyerId}
                onClick={() => applyStatus("sold", selectedBuyerId)}
                className="ui-btn-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? "ინახება…" : "გაყიდულად მონიშვნა"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
