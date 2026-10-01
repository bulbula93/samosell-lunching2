"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { SETTINGS_EVENT, saveBrowserConsent } from "@/lib/browser-preferences"
import { clearAllListingDrafts } from "@/lib/listing-draft"
import { useBrowserConsent } from "./useBrowserConsent"

export function BrowserSettingsButton() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event(SETTINGS_EVENT))}
    className="text-xs text-white/70 underline underline-offset-4 hover:text-white">Cookies-ის პარამეტრები</button>
}

export default function BrowserConsentPanel() {
  const consent = useBrowserConsent()
  const [ready, setReady] = useState(false)
  const [opened, setOpened] = useState(false)
  const [details, setDetails] = useState(false)
  const [personalization, setPersonalization] = useState(false)
  const [analytics, setAnalytics] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)

  useEffect(() => {
    queueMicrotask(() => setReady(true))
    function open() {
      previousFocus.current = document.activeElement as HTMLElement | null
      setOpened(true)
      setDetails(true)
      setPersonalization(consent?.personalization ?? false)
      setAnalytics(consent?.analytics ?? false)
      requestAnimationFrame(() => heading.current?.focus())
    }
    window.addEventListener(SETTINGS_EVENT, open)
    return () => window.removeEventListener(SETTINGS_EVENT, open)
  }, [consent])

  async function choose(personal: boolean, stats: boolean) {
    saveBrowserConsent(personal, stats)
    if (!personal) await clearAllListingDrafts().catch(() => undefined)
    setOpened(false)
    setDetails(false)
    previousFocus.current?.focus()
  }

  if (!ready || (consent && !opened)) return null

  return (
    <section role="dialog" aria-modal="false" aria-labelledby="browser-consent-title"
      className="fixed inset-x-3 bottom-[calc(var(--mobile-nav-offset)+env(safe-area-inset-bottom)+0.75rem)] z-[150] mx-auto max-h-[75dvh] max-w-md overflow-y-auto rounded-2xl border border-brand/20 bg-white p-4 text-text shadow-[0_12px_45px_rgba(7,63,59,0.2)] sm:inset-x-auto sm:bottom-5 sm:left-5 sm:p-5">
      <h2 id="browser-consent-title" ref={heading} tabIndex={-1} className="text-base font-black">შენი არჩევანი, შენი კომფორტი</h2>
      <p className="mt-2 text-xs leading-6 text-text-soft">აუცილებელი cookies შესვლასა და უსაფრთხოებას ემსახურება. შენი თანხმობით დავიმახსოვრებთ ბოლოს ნანახ ნივთებს, ფილტრებსა და განცხადების მონახაზს ამ ბრაუზერში; ანალიტიკა საიტის გაუმჯობესებაში გვეხმარება.</p>
      <Link href="/privacy-policy#browser-storage" className="mt-2 inline-block text-xs font-bold text-brand underline">როგორ ვიყენებთ Cookies-სა და ბრაუზერში შენახვას</Link>
      {details ? <fieldset className="mt-3 space-y-3 rounded-xl bg-surface-alt p-3 text-sm">
        <legend className="sr-only">შენახვის პარამეტრები</legend>
        <label className="flex items-center gap-3"><input type="checkbox" checked disabled /> აუცილებელი — ყოველთვის ჩართული</label>
        <label className="flex items-center gap-3"><input type="checkbox" checked={personalization} onChange={(e) => setPersonalization(e.target.checked)} /> კომფორტი — ისტორია, ფილტრები, მონახაზი</label>
        <label className="flex items-center gap-3"><input type="checkbox" checked={analytics} onChange={(e) => setAnalytics(e.target.checked)} /> ანალიტიკა — ვიზიტები და ჩატვირთვის სიჩქარე</label>
        {consent?.analytics ? <p className="text-xs leading-5 text-text-soft">ანალიტიკის გამორთვისას გვერდი განახლდება. თუ ფორმას ავსებ, ჯერ დაასრულე ან შეინახე მონახაზი.</p> : null}
        <button type="button" onClick={() => void choose(personalization, analytics)} className="ui-btn-primary w-full">არჩევანის შენახვა</button>
      </fieldset> : null}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button type="button" onClick={() => void choose(true, true)} className="ui-btn-secondary px-2 text-xs">ყველას მიღება</button>
        <button type="button" onClick={() => void choose(false, false)} className="ui-btn-secondary px-2 text-xs">მხოლოდ აუცილებელი</button>
      </div>
      <button type="button" aria-expanded={details} onClick={() => {
        if (!details) { setPersonalization(consent?.personalization ?? false); setAnalytics(consent?.analytics ?? false) }
        setDetails(!details)
      }} className="mt-3 w-full text-xs font-bold text-brand underline">{details ? "პარამეტრების დამალვა" : "პარამეტრების არჩევა"}</button>
    </section>
  )
}
