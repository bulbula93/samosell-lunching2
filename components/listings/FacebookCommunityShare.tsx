"use client"

import { useId, useState } from "react"
import { normalizeFacebookGroupUrl, type ListingShareAction } from "@/lib/facebook-community"
import { trackListingShare } from "@/lib/growth/client"
import { buildListingSharePost } from "@/lib/share-post"

type Props = { listingId?: string; url: string; text: string; groupUrl?: string | null }

export default function FacebookCommunityShare({ listingId, url, text, groupUrl }: Props) {
  const id = useId()
  const [message, setMessage] = useState("")
  const [manualCopy, setManualCopy] = useState<string | null>(null)
  const safeGroupUrl = normalizeFacebookGroupUrl(groupUrl)

  function track(action: ListingShareAction) {
    if (listingId) void trackListingShare(listingId, action)
  }
  async function copy(kind: "post" | "link") {
    const value = kind === "post" ? buildListingSharePost(text, url) : url
    try {
      await navigator.clipboard.writeText(value)
      setManualCopy(null)
      setMessage(kind === "post" ? "პოსტის ტექსტი და ბმული დაკოპირდა." : "განცხადების ბმული დაკოპირდა.")
      track(kind === "post" ? "post_copied" : "link_copied")
    } catch {
      setManualCopy(value)
      setMessage("ავტომატური კოპირება ვერ მოხერხდა. მონიშნე ტექსტი და დააკოპირე ხელით.")
    }
  }

  return (
    <div className="mt-3 border-t border-line pt-3" aria-labelledby={id}>
      <h4 id={id} className="text-sm font-black text-text">გააზიარე Facebook ჯგუფში</h4>
      <p className="mt-1 text-xs leading-5 text-text-soft">
        თუ Facebook-ში ჯგუფს ვერ ირჩევ, დააკოპირე ტექსტი ან ბმული, გახსენი ჯგუფი და ჩასვი ახალ პოსტში.
        გამოქვეყნებას თავად ადასტურებ Facebook-ში; შესაძლოა ჯგუფის ადმინისტრატორის თანხმობა დაგჭირდეს.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="ui-btn-secondary min-h-11 text-xs" onClick={() => void copy("post")}>ტექსტის კოპირება</button>
        <button type="button" className="ui-btn-secondary min-h-11 text-xs" onClick={() => void copy("link")}>ბმულის კოპირება</button>
        {safeGroupUrl ? (
          <a className="ui-btn-secondary min-h-11 text-xs" href={safeGroupUrl} target="_blank" rel="noopener noreferrer" onClick={() => track("group_open_clicked")}>ჯგუფის გახსნა</a>
        ) : <span className="self-center text-xs text-text-soft">ჯგუფის ბმული ჯერ მითითებული არ არის.</span>}
      </div>
      <p role="status" aria-live="polite" className="mt-2 text-xs leading-5 text-text-soft">{message}</p>
      {manualCopy !== null ? (
        <label className="mt-2 block text-xs font-semibold text-text">ხელით დასაკოპირებელი ტექსტი
          <textarea readOnly value={manualCopy} onFocus={(event) => event.currentTarget.select()} className="ui-input mt-1 min-h-28 w-full break-all text-sm" />
        </label>
      ) : null}
    </div>
  )
}
