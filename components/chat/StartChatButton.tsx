"use client"

import { useActionState, useEffect, useState, type ReactNode } from "react"
import {
  startChatAction,
  type StartChatState,
} from "@/app/dashboard/chats/actions"
import SearchAttributionInput from "@/components/search/SearchAttributionInput"
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/chats"

const INITIAL_STATE: StartChatState = { ok: false, message: "" }

export default function StartChatButton({
  listingId,
  listingSlug,
  className,
  label = "მიწერე გამყიდველს",
  icon,
  presentation = "inline",
}: {
  listingId: string
  listingSlug: string
  className?: string
  label?: string
  icon?: ReactNode
  presentation?: "inline" | "sheet"
}) {
  const [open, setOpen] = useState(false)
  const [clientRequestId, setClientRequestId] = useState("")
  const [state, formAction, pending] = useActionState(
    startChatAction,
    INITIAL_STATE,
  )

  useEffect(() => {
    if (!open || presentation !== "sheet") return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [open, presentation])

  function openComposer() {
    setClientRequestId(crypto.randomUUID())
    setOpen(true)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={openComposer}
        className={className ?? "ui-btn-primary w-full"}
        aria-expanded="false"
      >
        {icon}
        <span>{label}</span>
      </button>
    )
  }

  const composer = (
    <form
      action={formAction}
      className={
        presentation === "sheet"
          ? "relative w-full max-h-[88vh] overflow-y-auto rounded-t-3xl border-t border-line bg-bg p-5 shadow-[0_-24px_60px_rgba(7,63,59,0.2)]"
          : "w-full rounded-2xl border border-brand/20 bg-brand-soft/45 p-4 sm:p-5"
      }
      style={
        presentation === "sheet"
          ? { paddingBottom: "max(1.25rem, env(safe-area-inset-bottom))" }
          : undefined
      }
      aria-labelledby="first-message-title"
    >
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="listingSlug" value={listingSlug} />
      <input type="hidden" name="clientRequestId" value={clientRequestId} />
      <SearchAttributionInput />

      {presentation === "sheet" ? (
        <div aria-hidden="true" className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
      ) : null}

      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id="first-message-title" className="text-base font-black text-text">
            პირველი შეტყობინება
          </h3>
          <p className="mt-1 text-sm leading-6 text-text-soft">
            მიმოწერა მხოლოდ წარმატებული გაგზავნის შემდეგ შეიქმნება.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          aria-label="შეტყობინების ფორმის დახურვა"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-white text-xl text-text transition hover:border-brand/40 disabled:opacity-50"
        >
          ×
        </button>
      </div>

      <label htmlFor="first-message-body" className="mt-4 block text-sm font-bold text-text">
        შეტყობინება
      </label>
      <textarea
        id="first-message-body"
        name="body"
        required
        autoFocus
        maxLength={CHAT_MESSAGE_MAX_LENGTH}
        aria-describedby="first-message-hint first-message-feedback"
        placeholder="მაგალითად: გამარჯობა, ნივთი ისევ ხელმისაწვდომია?"
        className="mt-2 min-h-28 w-full resize-y rounded-xl border border-line bg-white px-4 py-3 text-sm leading-6 text-text outline-none transition placeholder:text-text-soft focus:border-brand focus:ring-4 focus:ring-brand-soft"
      />
      <div id="first-message-hint" className="mt-2 text-xs leading-5 text-text-soft">
        მხოლოდ ტექსტი · მაქსიმუმ {CHAT_MESSAGE_MAX_LENGTH} სიმბოლო
      </div>

      <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          className="ui-btn-secondary"
        >
          გაუქმება
        </button>
        <button type="submit" disabled={pending} className="ui-btn-primary">
          {pending ? "იგზავნება…" : "გაგზავნა და ჩათის გახსნა"}
        </button>
      </div>

      <div
        id="first-message-feedback"
        role={state.message ? "alert" : "status"}
        aria-live="polite"
        className={state.message ? "mt-4 text-sm font-semibold text-red-700" : "sr-only"}
      >
        {state.message || (pending ? "შეტყობინება იგზავნება." : "")}
      </div>
    </form>
  )

  if (presentation === "sheet") {
    return (
      <div className="fixed inset-0 z-[120] flex items-end">
        <button
          type="button"
          aria-label="შეტყობინების ფორმის დახურვა"
          className="absolute inset-0 bg-text/45 backdrop-blur-[2px]"
          onClick={() => setOpen(false)}
        />
        {composer}
      </div>
    )
  }

  return composer
}
