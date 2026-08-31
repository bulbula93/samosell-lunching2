"use client"

import { useRouter } from "next/navigation"
import { useMemo, useState } from "react"
import { sendChatMessageAction } from "@/app/dashboard/chats/actions"
import {
  completeChatSaleAction,
  createChatOfferAction,
  releaseChatReservationAction,
  reserveChatListingAction,
  respondChatOfferAction,
} from "@/app/dashboard/chats/commerce-actions"
import { formatPrice } from "@/lib/listings"

export type ChatOfferSummary = {
  id: string
  amount: number
  currency: string
  status: "pending" | "accepted" | "rejected" | "withdrawn" | "released" | "completed"
  created_at: string
  responded_at: string | null
}

function offerStatusLabel(status: ChatOfferSummary["status"]) {
  switch (status) {
    case "pending": return "ელოდება პასუხს"
    case "accepted": return "მიღებულია"
    case "rejected": return "უარყოფილია"
    case "withdrawn": return "ჩანაცვლებულია"
    case "released": return "ჯავშანი მოხსნილია"
    case "completed": return "გაყიდვა დასრულებულია"
  }
}

export default function ChatCommercePanel({
  chatId,
  role,
  buyerId,
  currentUserId,
  listingStatus,
  listingPrice,
  currency,
  reservedForUserId,
  soldToUserId,
  initialOffers,
}: {
  chatId: string
  role: "buyer" | "seller"
  buyerId: string
  currentUserId: string
  listingStatus: string
  listingPrice: number
  currency: string
  reservedForUserId: string | null
  soldToUserId: string | null
  initialOffers: ChatOfferSummary[]
}) {
  const router = useRouter()
  const [offerAmount, setOfferAmount] = useState("")
  const [busyKey, setBusyKey] = useState("")
  const [feedback, setFeedback] = useState("")
  const [feedbackError, setFeedbackError] = useState(false)

  const pendingOffer = useMemo(
    () => initialOffers.find((offer) => offer.status === "pending") ?? null,
    [initialOffers],
  )
  const reservationForThisBuyer = listingStatus === "reserved" && reservedForUserId === buyerId
  const reservationForOtherBuyer = listingStatus === "reserved" && Boolean(reservedForUserId) && reservedForUserId !== buyerId
  const genericReservation = listingStatus === "reserved" && !reservedForUserId
  const soldToThisBuyer = listingStatus === "sold" && soldToUserId === buyerId

  const quickMessages = role === "buyer"
    ? ["ფასი საბოლოოა?", "სად შეიძლება ნივთის ნახვა?", "თუ თავისუფალია, შემატყობინე."]
    : ["დიახ, ნივთი ხელმისაწვდომია.", "ფასი საბოლოოა.", "შეგვიძლია დეტალები აქ შევათანხმოთ."]

  async function run(key: string, action: () => Promise<{ ok: boolean; message: string }>) {
    if (busyKey) return
    setBusyKey(key)
    setFeedback("")
    setFeedbackError(false)
    const result = await action()
    setFeedback(result.message)
    setFeedbackError(!result.ok)
    setBusyKey("")
    if (result.ok) router.refresh()
  }

  async function sendQuickMessage(text: string) {
    await run(`quick:${text}`, async () => {
      const result = await sendChatMessageAction({
        chatId,
        body: text,
        clientRequestId: crypto.randomUUID(),
      })
      return result.ok
        ? { ok: true, message: "შეტყობინება გაიგზავნა." }
        : { ok: false, message: result.message }
    })
  }

  async function submitOffer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const amount = Number(offerAmount)
    if (!Number.isFinite(amount) || amount <= 0 || amount > listingPrice) {
      setFeedbackError(true)
      setFeedback(`შეიყვანე თანხა 0-ზე მეტი და მაქსიმუმ ${formatPrice(listingPrice, currency)}.`)
      return
    }
    await run("offer", () => createChatOfferAction({ chatId, amount }))
    setOfferAmount("")
  }

  return (
    <section aria-labelledby="chat-commerce-title" className="ui-card p-6">
      <div className="ui-eyebrow">შეთანხმება</div>
      <h2 id="chat-commerce-title" className="mt-2 text-xl font-black text-text">
        სწრაფი მოქმედებები
      </h2>
      <p className="mt-2 text-sm leading-6 text-text-soft">
        ფასი, ჯავშანი და გაყიდვის დასრულება ამავე ჩათიდან მართე.
      </p>

      <div className="mt-4 flex flex-wrap gap-2" aria-label="სწრაფი შეტყობინებები">
        {quickMessages.map((text) => (
          <button
            key={text}
            type="button"
            disabled={Boolean(busyKey) || !["active", "reserved", "sold"].includes(listingStatus)}
            onClick={() => void sendQuickMessage(text)}
            className="rounded-full border border-line bg-white px-3 py-2 text-xs font-bold text-text transition hover:border-brand/35 hover:bg-brand-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busyKey === `quick:${text}` ? "იგზავნება…" : text}
          </button>
        ))}
      </div>

      {role === "buyer" && listingStatus === "active" ? (
        <form onSubmit={submitOffer} className="mt-5 rounded-2xl border border-line bg-surface-alt p-4">
          <label htmlFor="chat-offer-amount" className="text-sm font-black text-text">
            შესთავაზე ფასი
          </label>
          <p className="mt-1 text-xs leading-5 text-text-soft">
            განცხადების ფასი: {formatPrice(listingPrice, currency)}
          </p>
          <div className="mt-3 flex gap-2">
            <input
              id="chat-offer-amount"
              type="number"
              min="0.01"
              max={listingPrice}
              step="0.01"
              inputMode="decimal"
              value={offerAmount}
              onChange={(event) => setOfferAmount(event.target.value)}
              placeholder="მაგ. 80"
              className="ui-input min-w-0 flex-1"
            />
            <button type="submit" disabled={Boolean(busyKey) || !offerAmount} className="ui-btn-primary shrink-0">
              {busyKey === "offer" ? "იგზავნება…" : pendingOffer ? "ახალი შეთავაზება" : "შეთავაზება"}
            </button>
          </div>
        </form>
      ) : null}

      {role === "seller" && pendingOffer ? (
        <div className="mt-5 rounded-2xl border border-brand/25 bg-brand-soft/35 p-4">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-brand">ფასის შეთავაზება</div>
          <div className="mt-2 text-2xl font-black text-text">{formatPrice(pendingOffer.amount, pendingOffer.currency)}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={Boolean(busyKey) || listingStatus !== "active"}
              onClick={() => void run(`accept:${pendingOffer.id}`, () => respondChatOfferAction({ chatId, offerId: pendingOffer.id, action: "accept" }))}
              className="ui-btn-primary"
            >
              {busyKey === `accept:${pendingOffer.id}` ? "მუშავდება…" : "მიღება და დაჯავშნა"}
            </button>
            <button
              type="button"
              disabled={Boolean(busyKey)}
              onClick={() => void run(`reject:${pendingOffer.id}`, () => respondChatOfferAction({ chatId, offerId: pendingOffer.id, action: "reject" }))}
              className="ui-btn-secondary"
            >
              {busyKey === `reject:${pendingOffer.id}` ? "მუშავდება…" : "უარყოფა"}
            </button>
          </div>
        </div>
      ) : null}

      {role === "seller" && listingStatus === "active" ? (
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={Boolean(busyKey)}
            onClick={() => void run("reserve", () => reserveChatListingAction(chatId))}
            className="ui-btn-secondary"
          >
            {busyKey === "reserve" ? "მუშავდება…" : "ამ მყიდველისთვის დაჯავშნა"}
          </button>
          <button
            type="button"
            disabled={Boolean(busyKey)}
            onClick={() => {
              if (window.confirm("ნივთი ნამდვილად ამ მყიდველს მიჰყიდე? გაყიდულად მონიშვნის შემდეგ მას შეფასების დატოვება შეეძლება.")) {
                void run("sold", () => completeChatSaleAction(chatId))
              }
            }}
            className="ui-btn-primary"
          >
            {busyKey === "sold" ? "მუშავდება…" : "გაყიდულად მონიშვნა"}
          </button>
        </div>
      ) : null}

      {reservationForThisBuyer ? (
        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
          <div className="font-black">ნივთი ამ მყიდველისთვისაა დაჯავშნილი.</div>
          {role === "seller" ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={Boolean(busyKey)}
                onClick={() => void run("release", () => releaseChatReservationAction(chatId))}
                className="ui-btn-secondary"
              >
                {busyKey === "release" ? "მუშავდება…" : "ჯავშნის მოხსნა"}
              </button>
              <button
                type="button"
                disabled={Boolean(busyKey)}
                onClick={() => {
                  if (window.confirm("დაადასტურე, რომ ნივთი ამ მყიდველს მიჰყიდე.")) {
                    void run("sold", () => completeChatSaleAction(chatId))
                  }
                }}
                className="ui-btn-primary"
              >
                {busyKey === "sold" ? "მუშავდება…" : "გაყიდულად მონიშვნა"}
              </button>
            </div>
          ) : (
            <p className="mt-1">გამყიდველმა ნივთი შენთვის შეინახა.</p>
          )}
        </div>
      ) : null}

      {reservationForOtherBuyer || genericReservation ? (
        <p className="mt-5 rounded-xl border border-line bg-surface-alt px-4 py-3 text-sm leading-6 text-text-soft">
          ნივთი ამჟამად სხვა შეთანხმებით არის დაჯავშნილი. ამ ჩათიდან ჯავშნის ან გაყიდვის შეცვლა არ შეიძლება.
        </p>
      ) : null}

      {soldToThisBuyer ? (
        <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-emerald-900">
          გაყიდვა ამ მყიდველთან დასრულებულია. მყიდველს შეფასების მოთხოვნა შეტყობინებებში გაეგზავნა.
        </p>
      ) : listingStatus === "sold" ? (
        <p className="mt-5 rounded-xl border border-line bg-surface-alt px-4 py-3 text-sm leading-6 text-text-soft">
          განცხადება უკვე გაყიდულია.
        </p>
      ) : null}

      {initialOffers.length > 0 ? (
        <div className="mt-5 border-t border-line pt-4">
          <div className="text-xs font-black uppercase tracking-[0.14em] text-text-soft">შეთავაზებების ისტორია</div>
          <div className="mt-3 space-y-2">
            {initialOffers.slice(0, 4).map((offer) => (
              <div key={offer.id} className="flex items-center justify-between gap-3 rounded-xl bg-surface-alt px-3 py-2 text-sm">
                <span className="font-black text-text">{formatPrice(offer.amount, offer.currency)}</span>
                <span className="text-xs font-bold text-text-soft">{offerStatusLabel(offer.status)}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div
        role={feedbackError ? "alert" : "status"}
        aria-live="polite"
        className={feedback ? `mt-4 text-sm font-bold ${feedbackError ? "text-red-700" : "text-brand"}` : "sr-only"}
      >
        {feedback || `მზადაა ${currentUserId ? "" : ""}`}
      </div>
    </section>
  )
}
