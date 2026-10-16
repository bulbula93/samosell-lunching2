import { notFound } from "next/navigation"
import { isReadOnlyPreview } from "@/lib/preview-read-only"
import ClsAuditClient from "./ClsAuditClient"

export const dynamic = "force-dynamic"
export const metadata = { robots: { index: false, follow: false } }

export default function HomeClsAudit() {
  if (process.env.VERCEL_ENV !== "preview" || !isReadOnlyPreview()) notFound()
  return <ClsAuditClient />
}
