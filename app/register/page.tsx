import { redirect } from "next/navigation"
import AuthCard from "@/components/auth/AuthCard"
import RegisterForm from "@/components/auth/RegisterForm"
import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"
import { createClient } from "@/lib/supabase/server"

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>
}) {
  const params = (await searchParams) ?? {}
  const next = getSafeAuthRedirectPath(Array.isArray(params.next) ? params.next[0] : params.next)

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  }

  return (
    <AuthCard
      title="ახალი ანგარიში"
      subtitle="შექმენი პროფილი, განათავსე ტანსაცმელი და მართე შენი განცხადებები."
      altHref="/login"
      altText="უკვე გაქვს ანგარიში?"
      altLabel="შესვლა"
    >
      <RegisterForm nextPath={next} />
    </AuthCard>
  )
}
