export const dynamic = "force-dynamic"
export const revalidate = 0

import Link from "next/link"
import { requireAdminUser } from "@/lib/auth"
import { getFlittReadiness } from "@/lib/flitt"
import { getSupportConfig } from "@/lib/site"
import { getTbcCheckoutReadiness } from "@/lib/tbc"

type ReadinessItem = {
  label: string
  ok: boolean
  detail: string
  href?: string
}

function envPresent(name: string) {
  return Boolean(String(process.env[name] ?? "").trim())
}

export default async function AdminSystemPage() {
  const { supabase } = await requireAdminUser("/dashboard")
  const support = getSupportConfig()
  const tbc = getTbcCheckoutReadiness()

  let flitt: ReturnType<typeof getFlittReadiness> | null = null
  let flittConfigValid = true
  try {
    flitt = getFlittReadiness()
  } catch {
    flittConfigValid = false
  }

  const [
    profilesHealth,
    listingsHealth,
    paymentsHealth,
    adsHealth,
    supportHealth,
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("listings").select("id", { count: "exact", head: true }),
    supabase.from("listing_boost_orders").select("id", { count: "exact", head: true }),
    supabase.from("ads").select("id", { count: "exact", head: true }),
    supabase.from("support_tickets").select("id", { count: "exact", head: true }),
  ])

  const emailReady =
    envPresent("RESEND_API_KEY") &&
    (envPresent("NOTIFICATION_EMAIL_FROM") || envPresent("EMAIL_FROM"))
  const adminActivityEmailReady = envPresent("ADMIN_ACTIVITY_EMAIL")
  const databaseReady =
    !profilesHealth.error &&
    !listingsHealth.error &&
    !paymentsHealth.error &&
    !adsHealth.error &&
    !supportHealth.error

  const items: ReadinessItem[] = [
    {
      label: "Database",
      ok: databaseReady,
      detail: databaseReady
        ? "profiles, listings, payments და ads ხელმისაწვდომია"
        : "ერთი ან მეტი ძირითადი table query ვერ შესრულდა",
    },
    {
      label: "Transactional email",
      ok: emailReady,
      detail: emailReady
        ? "Resend key და sender configuration არსებობს"
        : "Resend ან sender configuration აკლია",
    },
    {
      label: "Admin activity email",
      ok: adminActivityEmailReady,
      detail: adminActivityEmailReady
        ? "Admin activity recipient configured"
        : "ADMIN_ACTIVITY_EMAIL არ არის configured",
    },
    {
      label: "Support ticketing",
      ok: !supportHealth.error,
      detail: !supportHealth.error
        ? "Support მოთხოვნები DB-ში ინახება; email დამატებითი notification არხია"
        : "Support ticket storage query ვერ შესრულდა",
      href: "/admin/support",
    },
    {
      label: "Support email notification",
      ok: emailReady && Boolean(support.supportEmail),
      detail: emailReady
        ? "ახალი ticket-ის შესახებ support email notification მზადაა"
        : "Support email notification configuration არასრულია",
      href: "/admin/support",
    },
    {
      label: "TBC Checkout",
      ok: tbc.enabled,
      detail: tbc.enabled
        ? "Feature flag და საჭირო credentials მზადაა"
        : "Checkout სრულ readiness-ში არ არის",
      href: "/admin/payments/readiness",
    },
    {
      label: "Flitt",
      ok: flittConfigValid && Boolean(flitt?.liveEnabled || flitt?.sandboxEnabled),
      detail: !flittConfigValid
        ? "Flitt configuration invalid"
        : flitt?.liveEnabled
          ? "Live checkout enabled"
          : flitt?.sandboxEnabled
            ? "Sandbox checkout enabled"
            : `Mode: ${flitt?.mode ?? "unknown"} · checkout disabled`,
      href: "/admin/flitt-sandbox",
    },
  ]

  const okCount = items.filter((item) => item.ok).length

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">Admin / System</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              System Status
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              Production readiness-ის უსაფრთხო ხედვა. Secret/API key მნიშვნელობები აქ არასოდეს ჩანს — მხოლოდ configuration-ის არსებობა და ოპერაციული სტატუსი.
            </p>
          </div>
          <Link href="/admin" className="ui-btn-secondary">
            ადმინისტრირების მთავარი
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <div className="ui-card p-5">
          <div className="text-sm font-semibold text-text-soft">Ready checks</div>
          <div className="mt-2 text-3xl font-black text-text">
            {okCount}/{items.length}
          </div>
        </div>
        <div className="ui-card p-5">
          <div className="text-sm font-semibold text-text-soft">Support architecture</div>
          <div className="mt-2 text-lg font-black text-text">DB ticketing + email</div>
          <p className="mt-2 text-sm leading-6 text-text-soft">
            Support მოთხოვნა ჯერ durable ticket-ად ინახება, შემდეგ კი email notification იგზავნება. Email-ის ჩავარდნა ticket-ს არ კარგავს.
          </p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {items.map((item) => (
          <article key={item.label} className="ui-card p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-black text-text">{item.label}</div>
                <p className="mt-2 text-sm leading-6 text-text-soft">{item.detail}</p>
              </div>
              <span
                className={
                  item.ok
                    ? "rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800"
                    : "rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-900"
                }
              >
                {item.ok ? "READY" : "CHECK"}
              </span>
            </div>
            {item.href ? (
              <Link href={item.href} className="ui-btn-secondary mt-4">
                დეტალების გახსნა
              </Link>
            ) : null}
          </article>
        ))}
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <div className="ui-eyebrow">Safe configuration summary</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
            <span className="font-semibold text-text">Support response:</span> {support.responseTime}
          </div>
          <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
            <span className="font-semibold text-text">Business hours:</span> {support.businessHours}
          </div>
          <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
            <span className="font-semibold text-text">TBC site:</span>{" "}
            {tbc.siteUrlIsProduction ? "production URL" : "non-production URL"}
          </div>
          <div className="rounded-[1rem] bg-surface-alt px-4 py-3 text-sm text-text-soft">
            <span className="font-semibold text-text">Flitt mode:</span>{" "}
            {flittConfigValid ? flitt?.mode ?? "unknown" : "invalid"}
          </div>
        </div>
      </section>
    </main>
  )
}
