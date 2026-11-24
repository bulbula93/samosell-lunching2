"use client"

import { useState } from "react"
import { enablePushSubscription, fetchPushConfig, hasBrowserPushSubscription, readPushEnvironment } from "@/lib/push-client"

/** Once per browser: after any answer (or "ახლა არა") the step never shows again. */
export const PUSH_PROMPT_KEY = "samosell:push-prompt:v1"

export type PushOptInMode = "enable" | "ios"

function promptAlreadyShown() {
  try { return localStorage.getItem(PUSH_PROMPT_KEY) === "1" } catch { return true }
}
export function markPushPromptShown() {
  try { localStorage.setItem(PUSH_PROMPT_KEY, "1") } catch { /* private mode: nothing to remember */ }
}

/**
 * Decides whether the post-publish step should appear and which variant.
 * null = skip (already asked, already on, blocked, unsupported or push not configured).
 */
export async function resolvePushOptIn(): Promise<{ mode: PushOptInMode; vapidPublicKey: string } | null> {
  if (typeof window === "undefined" || promptAlreadyShown()) return null
  const env = readPushEnvironment()

  // iPhone/iPad in a Safari tab: Web Push only works from the Home Screen.
  if (env.ios && !env.standalone) return { mode: "ios", vapidPublicKey: "" }
  if (!env.supported || env.permission !== "default") return null

  const [{ vapidPublicKey }, subscribed] = await Promise.all([fetchPushConfig(), hasBrowserPushSubscription()])
  if (!vapidPublicKey || subscribed) return null
  return { mode: "enable", vapidPublicKey }
}

type Step = "intro" | "asking" | "done" | "blocked" | "failed"

type Props = {
  mode: PushOptInMode
  vapidPublicKey: string
  onClose: () => void
}

function BellIcon({ size = 26, color = "#075a53" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  )
}

/** Example of what a buyer message looks like on the lock screen (illustration, not real data). */
function SampleNotification({ time = "ახლა", faded = false }: { time?: string; faded?: boolean }) {
  return (
    <div aria-hidden="true" className={`flex items-start gap-3 rounded-[18px] border border-[#e3e9e7] bg-white/95 px-3.5 py-3 shadow-[0_8px_24px_rgba(7,63,59,0.16)] ${faded ? "-mt-1 scale-[0.94] opacity-45" : ""}`}>
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-[#073f3b] text-base font-black text-[#fd7b01]">S</span>
      <span className="min-w-0 flex-1">
        <span className="flex justify-between text-xs text-text-soft"><b className="font-extrabold text-text">SamoSell</b><span>{time}</span></span>
        <span className="mt-0.5 block text-sm font-extrabold">ნინი მოგწერა · ზარას შავი ჯინსი</span>
        <span className="block text-[13px] text-text-soft">„ჯერ კიდევ გაქვს? შეიძლება დღეს ვნახო?“</span>
      </span>
    </div>
  )
}

const primary = "flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-[14px] bg-[#075a53] text-base font-extrabold text-white transition hover:bg-[#073f3b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
const ghost = "min-h-11 text-[15px] font-bold text-text-soft"

export default function PushOptInStep({ mode, vapidPublicKey, onClose }: Props) {
  const [step, setStep] = useState<Step>("intro")

  function close() {
    markPushPromptShown()
    onClose()
  }

  async function enable() {
    markPushPromptShown() // the browser asks only once; never re-prompt from here
    setStep("asking")
    const result = await enablePushSubscription(vapidPublicKey)
    setStep(result === "enabled" ? "done" : result === "failed" ? "failed" : result === "denied" ? "blocked" : "intro")
  }

  if (mode === "ios") {
    const steps: Array<{ text: React.ReactNode; icon: React.ReactNode }> = [
      {
        text: <>ქვემოთ დააჭირე <b>„გაზიარება“</b></>,
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>,
      },
      {
        text: <>აირჩიე <b>„Add to Home Screen“</b></>,
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 8v8M8 12h8" /></svg>,
      },
      {
        text: <>გახსენი <b>SamoSell</b> მთავარი ეკრანიდან → <b>შეტყობინებები</b> → „ჩართვა“</>,
        icon: <span aria-hidden="true" className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-[#073f3b] text-[13px] font-black text-[#fd7b01]">S</span>,
      },
    ]
    return (
      <div className="flex flex-col gap-4" data-testid="push-optin-ios">
        <div className="flex items-center gap-3 pr-10">
          <span className="flex h-12 w-12 flex-none items-center justify-center rounded-[14px] bg-[#eaf5f3]"><BellIcon /></span>
          <div>
            <h2 id="share-after-publish-title" className="text-xl font-black leading-tight">iPhone-ზე შეტყობინებებისთვის</h2>
            <p className="text-sm leading-6 text-text-soft">დაამატე SamoSell მთავარ ეკრანზე — 15 წამი.</p>
          </div>
        </div>
        <ol className="flex flex-col gap-2">
          {steps.map((item, index) => (
            <li key={index} className="flex items-center gap-3 rounded-[14px] bg-surface-alt p-3">
              <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#075a53] text-sm font-black text-white">{index + 1}</span>
              <span className="flex-1 text-sm leading-6">{item.text}</span>
              {item.icon}
            </li>
          ))}
        </ol>
        <p className="rounded-xl bg-[#fff6ed] px-3 py-2.5 text-[13px] leading-5 text-[#5a3a12]">ახლა თუ არა — პირველ შეტყობინებაზე ელფოსტაზე მაინც მოგწერთ.</p>
        <button type="button" onClick={close} className={primary}>გასაგებია</button>
        <button type="button" onClick={close} className={`${ghost} -mt-2`}>ახლა არა</button>
      </div>
    )
  }

  if (step === "done") {
    return (
      <div className="flex flex-col gap-4" data-testid="push-optin-done">
        <div className="flex flex-col items-center gap-2.5 pt-2 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#e3f4ee]">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0a7a52" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
          </span>
          <h2 id="share-after-publish-title" role="status" className="text-[22px] font-black">შეტყობინებები ჩართულია</h2>
          <p className="max-w-[300px] text-sm leading-6 text-text-soft">ახლა მყიდველის მესიჯი ასე გამოჩნდება შენს ტელეფონზე:</p>
        </div>
        <div className="rounded-[20px] bg-[linear-gradient(160deg,#1d2b29_0%,#2f4440_100%)] px-3.5 py-[18px]">
          <SampleNotification />
        </div>
        <button type="button" onClick={onClose} className={primary}>კარგი</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4" data-testid="push-optin-enable">
      <span className="inline-flex items-center gap-2 self-start rounded-full bg-[#eaf5f3] px-3 py-1.5 text-xs font-extrabold text-[#075a53]">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
        განცხადება გამოქვეყნდა
      </span>
      <div className="flex flex-col gap-2.5 rounded-[20px] bg-[linear-gradient(160deg,#e6f2ef_0%,#f7faf9_100%)] px-3.5 pb-4 pt-[18px]">
        <SampleNotification />
        <SampleNotification time="2 წთ" faded />
      </div>
      <div>
        <h2 id="share-after-publish-title" className="text-[22px] font-black leading-tight tracking-[-0.02em]">გაიგე მაშინვე, როცა მყიდველი მოგწერს</h2>
        <p className="mt-1.5 text-sm leading-6 text-text-soft">ვინც სწრაფად პასუხობს, უფრო სწრაფად ყიდის. შეტყობინება ტელეფონზე მოგივა, საიტი გახსნილი რომ არ გქონდეს.</p>
      </div>
      {step === "blocked" ? (
        <p role="status" className="rounded-xl bg-[#fff6ed] px-3 py-2.5 text-[13px] leading-5 text-[#5a3a12]">ბრაუზერმა შეტყობინებები დაბლოკა. ჩართვა შეგიძლია ბრაუზერის პარამეტრებიდან, მერე კი „შეტყობინებების“ გვერდიდან.</p>
      ) : null}
      {step === "failed" ? (
        <p role="status" className="rounded-xl bg-[#fff6ed] px-3 py-2.5 text-[13px] leading-5 text-[#5a3a12]">ჩართვა ვერ მოხერხდა. სცადე მოგვიანებით „შეტყობინებების“ გვერდიდან.</p>
      ) : null}
      {step === "intro" || step === "asking" ? (
        <>
          <button type="button" onClick={enable} disabled={step === "asking"} className={primary}>
            <BellIcon size={22} color="#ffffff" />{step === "asking" ? "დაელოდე ბრაუზერის კითხვას…" : "შეტყობინებების ჩართვა"}
          </button>
          {step === "asking" ? (
            <p role="status" className="-mt-1.5 text-center text-[13px] font-bold text-[#b4590a]">ბრაუზერის ფანჯარაში დააჭირე „Allow“ (დაშვება)</p>
          ) : (
            <p className="-mt-1.5 text-center text-xs leading-5 text-text-soft">მხოლოდ ჩატი და შენი განცხადებები — რეკლამას არ გამოგიგზავნით. გამორთვა „შეტყობინებების“ გვერდიდან ნებისმიერ დროს.</p>
          )}
        </>
      ) : null}
      <button type="button" onClick={close} className={ghost}>{step === "blocked" || step === "failed" ? "დახურვა" : "ახლა არა"}</button>
    </div>
  )
}
