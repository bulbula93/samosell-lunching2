import type { Metadata } from "next"
import { redirect } from "next/navigation"
import AuthCard from "@/components/auth/AuthCard"
import ResetPasswordForm from "@/components/auth/ResetPasswordForm"
import { createClient } from "@/lib/supabase/server"
import { getAuthPagePath, getSafeAuthRedirectPath } from "@/lib/auth-redirect"

export const metadata: Metadata = {
  title: "ახალი პაროლი",
  robots: { index: false, follow: false },
}

export default async function ResetPasswordPage({ searchParams }: {
  searchParams?: Promise<{ next?: string | string[] }>
}) {
  const params = (await searchParams) ?? {}
  const next = getSafeAuthRedirectPath(Array.isArray(params.next) ? params.next[0] : params.next)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const recoveryPath = getAuthPagePath("/forgot-password", next)
    redirect(`${recoveryPath}${recoveryPath.includes("?") ? "&" : "?"}error=invalid_or_expired`)
  }

  return (
    <AuthCard
      title="ახალი პაროლი"
      subtitle="შექმენი ახალი პაროლი ანგარიშისთვის. შენახვის შემდეგ თავიდან შეხვალ ახალი პაროლით."
      altHref={getAuthPagePath("/login", next)}
      altText="აღდგენის გაუქმება?"
      altLabel="შესვლაზე დაბრუნება"
    >
      <ResetPasswordForm nextPath={next} />
    </AuthCard>
  )
}
