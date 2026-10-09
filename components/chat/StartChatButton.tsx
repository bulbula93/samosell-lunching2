"use client"

import { useActionState, useLayoutEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  startChatAction,
  type StartChatState,
} from "@/app/dashboard/chats/actions"
import SearchAttributionInput from "@/components/search/SearchAttributionInput"
import { CHAT_MESSAGE_MAX_LENGTH } from "@/lib/chats"
import Avatar from "@/components/shared/Avatar"
import SmartImage from "@/components/shared/SmartImage"

const INITIAL_STATE: StartChatState = { ok: false, message: "" }

function SellerAvatar({ src, label, large = false }: { src?: string | null; label: string; large?: boolean }) {
  const size = large ? "h-18 w-18 shrink-0" : "h-10 w-10 shrink-0"
  if (src) return <Avatar src={src} alt={label} fallbackText={label} sizeClassName={size} />
  return (
    <div aria-hidden="true" className={`flex items-center justify-center rounded-full bg-brand-soft text-brand ${size}`}>
      <svg viewBox="0 0 24 24" className={large ? "h-9 w-9" : "h-5 w-5"} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></svg>
    </div>
  )
}

export default function StartChatButton({
  listingId,
  listingSlug,
  className,
  label = "მიწერე გამყიდველს",
  icon,
  presentation = "inline",
  sellerLabel = "გამყიდველი",
  sellerAvatarSrc,
  listingTitle,
  listingImageSrc,
  priceLabel,
}: {
  listingId: string
  listingSlug: string
  className?: string
  label?: string
  icon?: ReactNode
  presentation?: "inline" | "sheet" | "responsive"
  sellerLabel?: string
  sellerAvatarSrc?: string | null
  listingTitle?: string
  listingImageSrc?: string | null
  priceLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [clientRequestId, setClientRequestId] = useState("")
  const [sheetMode, setSheetMode] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [body, setBody] = useState("")
  const [state, formAction, pending] = useActionState(
    startChatAction,
    INITIAL_STATE,
  )

  useLayoutEffect(() => {
    if (!open || !sheetMode) return
    const pageX = window.scrollX
    const pageY = window.scrollY
    const body = document.body
    const root = document.documentElement
    const bodyProperties = ["position", "top", "left", "width", "height", "overflow", "overscroll-behavior"]
    const rootProperties = ["overflow", "overscroll-behavior"]
    const previousBody = bodyProperties.map((property) => [property, body.style.getPropertyValue(property), body.style.getPropertyPriority(property)])
    const previousRoot = rootProperties.map((property) => [property, root.style.getPropertyValue(property), root.style.getPropertyPriority(property)])
    const viewport = window.visualViewport
    const fullHeight = Math.max(window.innerHeight, viewport?.height ?? 0)
    let frame = 0
    let settleTimer = 0
    let touchY = 0
    const updateViewport = () => {
      const sheet = sheetRef.current
      if (!sheet) return
      sheet.style.top = `${viewport?.offsetTop ?? 0}px`
      sheet.style.left = `${viewport?.offsetLeft ?? 0}px`
      sheet.style.width = `${viewport?.width ?? window.innerWidth}px`
      const height = viewport?.height ?? window.innerHeight
      sheet.style.height = `${height}px`
      sheet.dataset.compact = String(height < 420)
      // iOS keeps the home-indicator inset even while the keyboard is visible.
      sheet.style.setProperty("--chat-bottom-inset", height < fullHeight - 150 ? "0px" : "env(safe-area-inset-bottom)")
    }
    const scheduleViewport = () => {
      updateViewport()
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateViewport)
      window.clearTimeout(settleTimer)
      settleTimer = window.setTimeout(updateViewport, 350)
    }
    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 1) touchY = event.touches[0].clientY
    }
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      const delta = event.touches[0].clientY - touchY
      touchY = event.touches[0].clientY
      const target = event.target instanceof Element ? event.target : null
      const scroller = target?.closest<HTMLElement>("[data-chat-scrollable]")
      if (scroller && sheetRef.current?.contains(scroller)) {
        const maxScroll = scroller.scrollHeight - scroller.clientHeight
        if (maxScroll > 1 && ((delta < 0 && scroller.scrollTop < maxScroll - 1) || (delta > 0 && scroller.scrollTop > 0))) return
      }
      // Stop scroll chaining and rubber-banding into the listing on iOS.
      if (event.cancelable) event.preventDefault()
    }

    Object.assign(body.style, { position: "fixed", top: `${-pageY}px`, left: `${-pageX}px`, width: "100%", height: "100%", overflow: "hidden", overscrollBehavior: "none" })
    Object.assign(root.style, { overflow: "hidden", overscrollBehavior: "none" })
    updateViewport()
    window.addEventListener("resize", scheduleViewport)
    viewport?.addEventListener("resize", scheduleViewport)
    viewport?.addEventListener("scroll", scheduleViewport)
    document.addEventListener("focusin", scheduleViewport)
    document.addEventListener("focusout", scheduleViewport)
    document.addEventListener("touchstart", onTouchStart, { passive: true })
    document.addEventListener("touchmove", onTouchMove, { passive: false })
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(settleTimer)
      window.removeEventListener("resize", scheduleViewport)
      viewport?.removeEventListener("resize", scheduleViewport)
      viewport?.removeEventListener("scroll", scheduleViewport)
      document.removeEventListener("focusin", scheduleViewport)
      document.removeEventListener("focusout", scheduleViewport)
      document.removeEventListener("touchstart", onTouchStart)
      document.removeEventListener("touchmove", onTouchMove)
      for (const [property, value, priority] of previousBody) body.style.setProperty(property, value, priority)
      for (const [property, value, priority] of previousRoot) root.style.setProperty(property, value, priority)
      window.scrollTo({ left: pageX, top: pageY, behavior: "instant" })
    }
  }, [open, sheetMode])

  function openComposer() {
    const shouldUseSheet =
      presentation === "sheet" ||
      (presentation === "responsive" &&
        window.matchMedia("(max-width: 767px)").matches)
    setSheetMode(shouldUseSheet)
    setBody("")
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

  function updateBody(value: string) {
    setBody(value)
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = "auto"
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`
    }
  }

  const composer = (
    <form
      ref={formRef}
      action={formAction}
      aria-labelledby="first-message-title"
      className={`relative flex min-h-0 min-w-0 w-full max-w-full flex-col overflow-hidden bg-white ${
        sheetMode
          ? "h-full"
          : "h-[min(70dvh,520px)] min-h-80 rounded-2xl border border-line shadow-sm"
      }`}
    >
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="listingSlug" value={listingSlug} />
      <input type="hidden" name="clientRequestId" value={clientRequestId} />
      <SearchAttributionInput />

      <header
        className="flex shrink-0 items-center gap-2 border-b border-line/60 bg-white px-3 pb-3 pt-3"
        style={sheetMode ? { paddingTop: "max(0.75rem, env(safe-area-inset-top))" } : undefined}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          disabled={pending}
          aria-label="შეტყობინების ფორმის დახურვა"
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-brand transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m14 6-6 6 6 6" /></svg>
        </button>
        <SellerAvatar src={sellerAvatarSrc} label={sellerLabel} />
        <div className="min-w-0 flex-1">
          <h3 id="first-message-title" className="truncate text-base font-semibold text-text">{sellerLabel}</h3>
          <p className="mt-0.5 text-xs text-text-soft">ნივთის შესახებ</p>
        </div>
      </header>

      {listingTitle ? (
        <div className="flex shrink-0 items-center gap-3 border-b border-line/60 bg-surface-alt/50 px-4 py-3 group-data-[compact=true]/chat-composer:hidden">
          {listingImageSrc ? <SmartImage src={listingImageSrc} alt={listingTitle} sizes="48px" loading="eager" wrapperClassName="h-12 w-12 shrink-0 rounded-xl" /> : null}
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 break-words text-sm font-medium text-text">{listingTitle}</p>
            {priceLabel ? <p className="mt-0.5 text-sm font-semibold text-brand">{priceLabel}</p> : null}
          </div>
        </div>
      ) : null}

      <div data-chat-scrollable className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
        <div className="flex min-h-full flex-col items-center justify-center px-6 py-8 text-center">
          <SellerAvatar src={sellerAvatarSrc} label={sellerLabel} large />
          <p className="mt-4 max-w-full break-words text-lg font-semibold text-text">მიწერე {sellerLabel === "გამყიდველი" ? "გამყიდველს" : sellerLabel + "-ს"}</p>
          <p className="mt-2 max-w-64 text-sm leading-6 text-text-soft">ჰკითხე ნივთის შესახებ და შეთანხმდით დეტალებზე.</p>
          <div className="mt-5 flex max-w-full flex-wrap justify-center gap-2">
            {["ჯერ კიდევ იყიდება?", "სად შეიძლება ნახვა?"].map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                disabled={pending}
                onClick={() => {
                  updateBody(suggestion)
                  textareaRef.current?.focus()
                }}
                className="min-h-11 rounded-full border border-line bg-white px-3 py-2 text-xs font-medium text-text-soft transition hover:border-brand/30 hover:bg-brand-soft/40 disabled:opacity-50"
              >{suggestion}</button>
            ))}
          </div>
        </div>
      </div>

      <div
        className="shrink-0 border-t border-line/50 bg-white px-3 pt-3"
        style={{ paddingBottom: "max(0.75rem, var(--chat-bottom-inset, env(safe-area-inset-bottom)))" }}
      >
        <div className="flex items-end gap-2">
          <label htmlFor="first-message-body" className="sr-only">შეტყობინება</label>
          <textarea
            ref={textareaRef}
            data-chat-scrollable
            id="first-message-body"
            name="body"
            rows={1}
            required
            autoFocus={!sheetMode}
            value={body}
            onChange={(event) => updateBody(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                if (body.trim() && !pending) formRef.current?.requestSubmit()
              }
            }}
            disabled={pending}
            maxLength={CHAT_MESSAGE_MAX_LENGTH}
            enterKeyHint="send"
            aria-describedby="first-message-hint first-message-feedback"
            placeholder="შეტყობინება…"
            style={{ outline: "none" }}
            className="max-h-30 min-h-11 min-w-0 flex-1 resize-none overflow-y-auto rounded-3xl border border-transparent bg-surface-alt px-4 py-3 text-base leading-5 text-text outline-none placeholder:text-text-soft focus:border-brand/25 focus:ring-0 focus-visible:outline-none disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={pending || !body.trim()}
            aria-label={pending ? "იგზავნება…" : "გაგზავნა"}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand text-white transition hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:bg-surface-alt disabled:text-text-soft/40"
          >
            {pending ? <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-white/40 border-t-white" /> : <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor"><path d="M3.4 3.15a.8.8 0 0 0-1.05.99L5.1 11l8.4 1-8.4 1-2.75 6.86a.8.8 0 0 0 1.05.99l17.4-8.13a.8.8 0 0 0 0-1.44Z" /></svg>}
          </button>
        </div>
        <p id="first-message-hint" className="sr-only">მაქსიმუმ {CHAT_MESSAGE_MAX_LENGTH} სიმბოლო. Enter — გაგზავნა, Shift და Enter — ახალი ხაზი.</p>
        {body.length >= CHAT_MESSAGE_MAX_LENGTH - 200 ? <p className="mt-1 text-right text-[11px] text-text-soft">{body.length}/{CHAT_MESSAGE_MAX_LENGTH}</p> : null}
        <div
          id="first-message-feedback"
          role={state.message ? "alert" : "status"}
          aria-live="polite"
          className={state.message ? "mt-2 text-sm text-red-700" : "sr-only"}
        >{state.message || (pending ? "შეტყობინება იგზავნება." : "")}</div>
      </div>
    </form>
  )

  if (sheetMode) {
    // The action bar's backdrop-filter creates a containing block for fixed children.
    return createPortal(
      <div data-chat-screen className="fixed inset-0 z-[120] overflow-hidden overscroll-none bg-white">
        <div
          ref={sheetRef}
          role="dialog"
          aria-modal="true"
          aria-label="პირველი შეტყობინება"
          className="group/chat-composer absolute left-0 top-0 flex h-[100dvh] w-full items-end bg-white"
        >
          {composer}
        </div>
      </div>,
      document.body,
    )
  }

  return composer
}
