import type { Metadata } from "next"
import { redirect } from "next/navigation"
import AuthCard from "@/components/auth/AuthCard"
import ResetPasswordForm from "@/components/auth/ResetPasswordForm"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "ახალი პაროლი",
  robots: { index: false, follow: false },
}

export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/forgot-password?error=invalid_or_expired")
  }

  return (
    <AuthCard
      title="ახალი პაროლი"
      subtitle="შექმენი ახალი პაროლი ანგარიშისთვის. შენახვის შემდეგ თავიდან შეხვალ ახალი პაროლით."
      altHref="/login"
      altText="აღდგენის გაუქმება?"
      altLabel="შესვლაზე დაბრუნება"
    >
      <ResetPasswordForm />
    </AuthCard>
  )
}
