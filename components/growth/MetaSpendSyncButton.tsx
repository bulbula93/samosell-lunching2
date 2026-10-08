"use client"
import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"

const messages: Record<string, string> = {
  meta_credentials_missing: "Meta-ის server API credentials ჯერ არ არის დაკავშირებული.",
  meta_sync_disabled: "Meta სინქრონიზაცია ჯერ არ არის გააქტიურებული.",
  meta_sync_busy: "სინქრონიზაცია მიმდინარეობს ან ახლახან შესრულდა. სცადე ერთ წუთში.",
  meta_authorization_failed: "Meta API-ის წვდომა უარყოფილია. გადაამოწმე token და ads_read უფლება.",
  meta_token_expired: "Meta token-ის ვადა ამოიწურა. განაახლე META_ADS_ACCESS_TOKEN ხანგრძლივი მოქმედების token-ით, ads_read უფლებით.",
  meta_token_invalid: "Meta token გაუქმებულია ან არ მოქმედებს. განაახლე META_ADS_ACCESS_TOKEN და ხელახლა სინქრონიზაცია გაუშვი.",
  meta_permission_denied: "Meta-ს ads_read უფლება ან სარეკლამო ანგარიშზე წვდომა აკლია. გადაამოწმე token-ის უფლებები და SamoSell Ads ანგარიშის მინიჭება.",
  meta_account_access_denied: "Token-ს SamoSell Ads ანგარიშის წაკითხვა არ შეუძლია. გადაამოწმე წვდომა ანგარიშზე 948841811174019.",
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
        setMessage(response.ok && result.ok ? "Meta ხარჯი სინქრონიზებულია." : messages[result.reason] ?? messages[result.error] ?? "სინქრონიზაცია ვერ შესრულდა. შენახული ხარჯი უცვლელია.")
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
