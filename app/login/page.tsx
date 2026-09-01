import type { Metadata } from "next"
import { redirect } from "next/navigation"
import AuthCard from "@/components/auth/AuthCard"
import LoginForm from "@/components/auth/LoginForm"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = {
  title: "შესვლა",
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[]; error?: string | string[] }>
}) {
  const params = (await searchParams) ?? {}
  const next = getSafeAuthRedirectPath(Array.isArray(params.next) ? params.next[0] : params.next)
  const authError = Array.isArray(params.error) ? params.error[0] : params.error

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect(next)
  }

  return (
    <AuthCard
      title="სისტემაში შესვლა"
      subtitle="შედი შენს ანგარიშში და მართე განცხადებები, პროფილი და ჩატები."
      altHref="/register"
      altText="ანგარიში არ გაქვს?"
      altLabel="რეგისტრაცია"
    >
      <LoginForm nextPath={next} initialError={authError === "oauth_callback_failed" ? "სოციალური ავტორიზაცია ვერ დასრულდა. თავიდან სცადე." : ""} />
    </AuthCard>
  )
}
