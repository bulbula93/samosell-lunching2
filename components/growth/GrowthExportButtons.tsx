"use client"

import { useState } from "react"

export default function GrowthExportButtons({ text, csv, filename }: { text: string; csv: string; filename: string }) {
  const [message, setMessage] = useState("")
  const [manual, setManual] = useState(false)
  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setManual(false)
      setMessage("ანგარიში დაკოპირებულია — ჩასვი ჩატში.")
    } catch {
      setManual(true)
      setMessage("ავტომატური კოპირება ვერ მოხერხდა. მონიშნე ტექსტი და დააკოპირე ხელით.")
    }
  }
  function download() {
    let url: string | undefined
    try {
      url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
      const anchor = document.createElement("a")
      anchor.href = url
      anchor.download = filename
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      setMessage("CSV ჩამოტვირთვა დაწყებულია.")
    } catch { setMessage("CSV ჩამოტვირთვა ვერ მოხერხდა. გამოიყენე ანგარიშის კოპირება.") }
    finally { if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000) }
  }
  return <div className="mt-4 min-w-0">
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copy} className="ui-btn-secondary min-h-11 px-4 py-2 text-sm">ანგარიშის კოპირება</button>
      <button type="button" onClick={download} className="ui-btn-secondary min-h-11 px-4 py-2 text-sm">CSV ჩამოტვირთვა</button>
    </div>
    <p role="status" className="mt-2 text-xs leading-5 text-text-soft">{message || "ექსპორტი მოიცავს არჩეული პერიოდის ეკრანზე ჩატვირთულ მონაცემებს."}</p>
    {manual ? <textarea aria-label="ანგარიში ხელით კოპირებისთვის" readOnly value={text} onFocus={event => event.currentTarget.select()} className="mt-3 min-h-48 w-full rounded-xl border border-line bg-white p-3 text-sm" /> : null}
  </div>
}
