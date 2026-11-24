"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import PushOptInStep, { markPushPromptShown, resolvePushOptIn, type PushOptInMode } from "@/components/listings/PushOptInStep"
import { canShareFiles, createInstagramStoryFile, facebookShareUrl, triggerFileDownload, withShareUtm } from "@/lib/share/story-image"

/** Shown once per listing: after "later"/close it never opens again for that listing. */
export const SHARE_PROMPT_KEY = (listingId: string) => `samosell:share-prompt:${listingId}`

type Props = {
  listingId: string
  /** Absolute public listing URL (no UTM; added per channel). */
  listingUrl: string
  title: string
  priceText: string
  imageUrl: string | null
}

type View = "choose" | "instagram" | "desktopInstagram" | "push"

function wasShown(listingId: string) {
  try { return localStorage.getItem(SHARE_PROMPT_KEY(listingId)) === "1" } catch { return false }
}
function markShown(listingId: string) {
  try { localStorage.setItem(SHARE_PROMPT_KEY(listingId), "1") } catch { /* private mode: shows again next time */ }
}

function InstagramIcon({ color = "currentColor" }: { color?: string }) {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill={color} stroke="none" /></svg>
}
function FacebookIcon() {
  return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 3h-2.5A3.5 3.5 0 0 0 9 6.5V9H6.5v3.5H9V21h3.5v-8.5h2.8l.7-3.5h-3.5V7a1 1 0 0 1 1-1H15z" /></svg>
}
function LinkIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></svg>
}

export default function ShareAfterPublishDialog({ listingId, listingUrl, title, priceText, imageUrl }: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>("choose")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState("")
  const [qr, setQr] = useState<string | null>(null)
  // Next step after sharing: offer chat notifications (once per browser, only when they can work).
  const [pushOptIn, setPushOptIn] = useState<{ mode: PushOptInMode; vapidPublicKey: string } | null>(null)
  const fileRef = useRef<Promise<File> | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const igUrl = withShareUtm(listingUrl, "instagram")

  useEffect(() => {
    if (wasShown(listingId)) return
    const t = window.setTimeout(() => setOpen(true), 600) // let the success screen land first
    return () => window.clearTimeout(t)
  }, [listingId])

  const storyFile = useCallback(() => {
    fileRef.current ??= createInstagramStoryFile({ title, priceText, imageUrl })
    fileRef.current.catch(() => { fileRef.current = null })
    return fileRef.current
  }, [title, priceText, imageUrl])

  // Prepare the image as soon as the dialog opens: the share sheet must open from the tap itself.
  useEffect(() => { if (open) void storyFile().catch(() => undefined) }, [open, storyFile])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    void resolvePushOptIn().then((next) => { if (!cancelled) setPushOptIn(next) }).catch(() => undefined)
    return () => { cancelled = true }
  }, [open])

  /**
   * Any close (X, Escape, backdrop, "მოგვიანებით", "დასრულება") on the share step moves on to the
   * notifications step when it can work; on the notifications step it closes and counts as "not now".
   */
  const close = useCallback(() => {
    markShown(listingId)
    if (view === "push") {
      markPushPromptShown()
      setOpen(false)
      return
    }
    if (pushOptIn) {
      setNotice("")
      setView("push")
      return
    }
    setOpen(false)
  }, [listingId, pushOptIn, view])

  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLElement>("button")?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close() }
    document.addEventListener("keydown", onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = overflow; prev?.focus?.() }
  }, [open, close])

  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); return true } catch { return false }
  }

  async function shareInstagram() {
    if (busy) return
    setBusy(true); setNotice("")
    const copied = copy(igUrl)
    try {
      const file = await storyFile()
      if (canShareFiles(file)) {
        await copied
        setView("instagram")
        try {
          await navigator.share({ files: [file], title: `${title} — SamoSell` })
          markShown(listingId)
        } catch (e) {
          if (!(e instanceof DOMException && e.name === "AbortError")) setNotice("გაზიარების მენიუ ვერ გაიხსნა — შეინახე სურათი ქვემოთ.")
        }
      } else {
        await copied
        setView("desktopInstagram")
        try {
          const QR = await import("qrcode")
          setQr(await QR.toDataURL(igUrl, { margin: 1, width: 168, color: { dark: "#073f3b", light: "#ffffff" } }))
        } catch { setQr(null) }
      }
    } catch {
      setNotice("სურათი ვერ შეიქმნა. სცადე თავიდან.")
    } finally {
      setBusy(false)
    }
  }

  async function saveImage() {
    try { triggerFileDownload(await storyFile()); setNotice("სურათი შენახულია.") } catch { setNotice("სურათი ვერ შეიქმნა. სცადე თავიდან.") }
  }

  async function copyLink() {
    setNotice((await copy(withShareUtm(listingUrl, "copy"))) ? "ბმული დაკოპირდა." : "კოპირება ვერ მოხერხდა.")
  }

  if (!open) return null

  const btnBase = "flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] text-base font-extrabold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-[rgba(15,25,23,0.55)] sm:items-center sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget) close() }}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-after-publish-title"
        className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-[24px] bg-white px-5 pb-7 pt-3 text-text shadow-[0_-12px_40px_rgba(7,63,59,0.18)] sm:max-w-[720px] sm:rounded-[24px] sm:p-8"
      >
        <div aria-hidden="true" className="mx-auto mb-1 h-1 w-10 rounded bg-[#d5dcda] sm:hidden" />
        <button type="button" onClick={close} aria-label="დახურვა" className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full text-text-soft hover:bg-surface-alt">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>

        {view === "choose" ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-7">
            <div className="flex items-center gap-4 sm:block">
              <div className="flex h-[135px] w-[76px] flex-none flex-col gap-1.5 rounded-xl bg-[#073f3b] p-2 sm:h-[320px] sm:w-[180px] sm:gap-2.5 sm:rounded-2xl sm:p-3.5">
                <div className="flex justify-center rounded-md bg-white p-1 sm:p-2">
                  {/* Same plain <img> as the site header: a static SVG needs no image optimizer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/brand/samosell-header-logo.svg" alt="Samo$ell" width={90} height={28} className="h-3.5 w-auto sm:h-6" />
                </div>
                <div className="relative flex-1 overflow-hidden rounded-md bg-[#dfe7e4] sm:rounded-[10px]">
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <span className="self-start rounded bg-[#fd7b01] px-1 text-[9px] font-black text-[#1f1306] sm:rounded-lg sm:px-2.5 sm:text-base">{priceText}</span>
              </div>
              <div className="sm:hidden">
                <h2 id="share-after-publish-title" className="text-[22px] font-black leading-tight tracking-[-0.02em]">განცხადება გამოქვეყნდა!</h2>
                <p className="mt-1.5 text-sm leading-6 text-text-soft">გაუზიარე მეგობრებს — ასე ნივთი უფრო სწრაფად იყიდება.</p>
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2.5">
              <div className="hidden sm:block">
                <h2 className="text-[28px] font-black tracking-[-0.02em]">განცხადება გამოქვეყნდა!</h2>
                <p className="mt-1 mb-2 text-[15px] leading-6 text-text-soft">გაუზიარე მეგობრებს — ასე ნივთი უფრო სწრაფად იყიდება.</p>
              </div>
              <button type="button" onClick={shareInstagram} disabled={busy} className={`${btnBase} bg-[#075a53] text-white hover:bg-[#073f3b]`}>
                <InstagramIcon />{busy ? "სურათი მზადდება…" : "Instagram Story-ში გაზიარება"}
              </button>
              <a
                href={facebookShareUrl(withShareUtm(listingUrl, "facebook"))}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => markShown(listingId)}
                className={`${btnBase} border-2 border-[#1877f2] bg-white text-[#1259b8] hover:bg-[#f1f6fe]`}
              >
                <FacebookIcon />Facebook-ზე გაზიარება
              </a>
              <button type="button" onClick={copyLink} className={`${btnBase} min-h-12 border border-[#d5dcda] bg-white text-[15px] font-bold`}>
                <LinkIcon />ბმულის კოპირება
              </button>
              <p className="mt-1.5 flex items-center gap-2.5 rounded-xl bg-[#fff6ed] px-3 py-2.5 text-[13px] leading-5 text-[#5a3a12]">
                გამოგვყევი <a href="https://www.instagram.com/samo.sell/" target="_blank" rel="noopener noreferrer" className="font-extrabold text-[#8a4508]">@samo.sell</a>-ზე — შენი ნივთიც შეიძლება ჩვენს გვერდზე გამოჩნდეს.
              </p>
              <button type="button" onClick={close} className="min-h-11 text-[15px] font-bold text-text-soft">მოგვიანებით</button>
            </div>
          </div>
        ) : null}

        {view === "instagram" ? (
          <div className="flex flex-col gap-4">
            <p role="status" className="rounded-xl border border-[#dceeea] bg-[#eff8f6] p-3 text-sm font-bold text-[#073f3b]">✓ სურათი მზადაა, ბმული დაკოპირდა</p>
            <h2 id="share-after-publish-title" className="text-xl font-black">Instagram-ში 3 ნაბიჯი</h2>
            <ol className="flex flex-col gap-3.5">
              {["გაზიარების მენიუში აირჩიე Instagram → Story", "ზემოთ დააჭირე სტიკერს და აირჩიე Link — ბმული უკვე დაკოპირებულია, უბრალოდ ჩასვი", "მონიშნე @samo.sell — შენს Story-ს ჩვენც გავაზიარებთ"].map((step, i) => (
                <li key={step} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#075a53] text-sm font-black text-white">{i + 1}</span>
                  <span className="pt-0.5 text-[15px] leading-6">{step}</span>
                </li>
              ))}
            </ol>
            <button type="button" onClick={shareInstagram} disabled={busy} className={`${btnBase} bg-[#075a53] text-white`}>გაზიარების მენიუს ხელახლა გახსნა</button>
            <button type="button" onClick={saveImage} className={`${btnBase} min-h-12 border border-[#d5dcda] bg-white text-[15px] font-bold`}>სურათის შენახვა ტელეფონში</button>
            <p className="text-center text-xs leading-5 text-text-soft">თუ მენიუში Instagram არ ჩანს, შეინახე სურათი და Instagram-ში ხელით დადე Story-დ.</p>
            <button type="button" onClick={close} className="min-h-11 text-[15px] font-bold text-text-soft">დასრულება</button>
          </div>
        ) : null}

        {view === "desktopInstagram" ? (
          <div className="flex flex-col gap-4">
            <h2 id="share-after-publish-title" className="text-xl font-black">Instagram Story</h2>
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-[#e3e8e6] p-4 sm:flex-row">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="QR კოდი: განცხადების გახსნა ტელეფონში" width={168} height={168} className="rounded-lg" />
              ) : null}
              <p className="text-[15px] leading-6">კომპიუტერიდან Instagram გაზიარებას არ იძლევა. <b>დაასკანერე QR ტელეფონით</b> და იქიდან დააჭირე „Instagram Story“-ს — ან ჩამოტვირთე სურათი და ატვირთე ხელით.</p>
            </div>
            <button type="button" onClick={saveImage} className={`${btnBase} bg-[#075a53] text-white`}>Story-ის სურათის ჩამოტვირთვა</button>
            <button type="button" onClick={() => setView("choose")} className="min-h-11 text-[15px] font-bold text-text-soft">უკან</button>
          </div>
        ) : null}

        {view === "push" && pushOptIn ? (
          <PushOptInStep mode={pushOptIn.mode} vapidPublicKey={pushOptIn.vapidPublicKey} onClose={() => setOpen(false)} />
        ) : null}

        {notice ? <p role="status" aria-live="polite" className="mt-3 text-center text-sm font-semibold text-brand">{notice}</p> : null}
      </div>
    </div>
  )
}
