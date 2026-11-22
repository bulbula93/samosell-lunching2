import type { Metadata } from "next"
import AuthCard from "@/components/auth/AuthCard"
import ForgotPasswordForm from "@/components/auth/ForgotPasswordForm"
import { getAuthPagePath, getSafeAuthRedirectPath } from "@/lib/auth-redirect"

export const metadata: Metadata = {
  title: "პაროლის აღდგენა",
  robots: { index: false, follow: false },
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string | string[]; next?: string | string[] }>
}) {
  const params = (await searchParams) ?? {}
  const error = Array.isArray(params.error) ? params.error[0] : params.error
  const next = getSafeAuthRedirectPath(Array.isArray(params.next) ? params.next[0] : params.next)
  const initialError =
    error === "invalid_or_expired"
      ? "აღდგენის ბმული არასწორია ან ვადაგასულია. მოითხოვე ახალი ბმული და ცადე თავიდან."
      : ""

  return (
    <AuthCard
      title="პაროლის აღდგენა"
      subtitle="შეიყვანე ანგარიშთან დაკავშირებული ელფოსტა. პაროლის შეცვლის უსაფრთხო ბმულს ელფოსტაზე გამოგიგზავნით."
      altHref={getAuthPagePath("/login", next)}
      altText="გაგახსენდა პაროლი?"
      altLabel="შესვლა"
    >
      <ForgotPasswordForm initialError={initialError} nextPath={next} />
    </AuthCard>
  )
}
