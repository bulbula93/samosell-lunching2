"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

const messages: Record<string, string> = {
  meta_credentials_missing: "Meta-ის server API credentials ჯერ არ არის დაკავშირებული.",
  meta_sync_disabled: "Meta სინქრონიზაცია ჯერ არ არის გააქტიურებული.",
  meta_sync_busy: "სინქრონიზაცია მიმდინარეობს ან ახლახან შესრულდა. სცადე ერთ წუთში.",
  meta_authorization_failed: "Meta API-ის წვდომა უარყოფილია. გადაამოწმე token და ads_read უფლება.",
  meta_account_mismatch: "Meta ანგარიში, ვალუტა ან timezone მოსალოდნელ მონაცემებს არ ემთხვევა.",
  meta_backend_not_allowed: "ამ გარემოში Meta ხარჯის შენახვა დაბლოკილია.",
}
export default function MetaSpendSyncButton({ configurationIssue }: { configurationIssue: string | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState("")
  function sync() {
    startTransition(async () => {
      try {
        const response = await fetch("/api/admin/growth/meta-spend/sync", { method: "POST" })
        const result = await response.json()
        setMessage(response.ok && result.ok ? "Meta ხარჯი სინქრონიზებულია." : messages[result.error] ?? "სინქრონიზაცია ვერ შესრულდა. შენახული ხარჯი უცვლელია.")
        router.refresh()
      } catch { setMessage("კავშირი ვერ მოხერხდა. სცადე მოგვიანებით.") }
    })
  }
  return <div className="space-y-2">
    <button type="button" className="ui-btn-secondary" disabled={pending || Boolean(configurationIssue)} onClick={sync}>{pending ? "სინქრონიზაცია…" : "Sync Meta spend"}</button>
    {configurationIssue ? <p className="text-sm text-text-soft">{messages[configurationIssue] ?? "Meta API კავშირი ჯერ არ არის გამართული."}</p> : null}
    <p role="status" aria-live="polite" className="text-sm text-text-soft">{message}</p>
  </div>
}
