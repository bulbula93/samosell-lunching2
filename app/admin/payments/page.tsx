import Link from "next/link"
import { refreshFlittPaymentAttemptAction } from "@/app/admin/payments/actions"
import StatCard from "@/components/shared/StatCard"
import { requireAdminUser } from "@/lib/auth"
import { getFlittReadiness } from "@/lib/flitt"
import { createAdminClient } from "@/lib/supabase/admin"

type Params = {
  status?: string | string[]
  scope?: string | string[]
  q?: string | string[]
  flash?: string | string[]
}

type FlittAttempt = {
  id: string
  order_id: string
  user_id: string
  mode: string
  purpose: string
  amount: number
  currency: string
  provider_payment_id: string | null
  status: string
  provider_status: string | null
  response_status: string | null
  callback_count: number
  last_callback_at: string | null
  provider_verified_at: string | null
  provider_verification_source: string | null
  boost_order_id: string | null
  ad_order_id: string | null
  created_at: string
  updated_at: string
}

const tabs = [
  ["all", "ყველა"],
  ["pending", "მოლოდინში"],
  ["approved", "წარმატებული"],
  ["failed", "წარუმატებელი"],
  ["reversed", "დაბრუნებული"],
] as const

const scopeTabs = [
  ["payments", "რეალური გადახდები"],
  ["validation", "Validation"],
  ["all", "ყველა LIVE"],
] as const

const STALE_PAYMENT_MINUTES = 30

function formatDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Tbilisi",
  }).format(new Date(value))
}

function formatAmount(minor: number, currency: string) {
  const value = Number(minor) / 100
  return `${value.toFixed(2)} ${currency === "GEL" ? "₾" : currency}`
}

function statusLabel(value: string) {
  switch (value) {
    case "pending": return "მოლოდინში"
    case "approved": return "წარმატებული"
    case "declined": return "უარყოფილი"
    case "expired": return "ვადაგასული"
    case "reversed": return "დაბრუნებული"
    case "failed": return "შეცდომა"
    default: return value || "უცნობი"
  }
}

function statusClass(value: string) {
  if (value === "approved") return "border-emerald-200 bg-emerald-50 text-emerald-800"
  if (value === "reversed") return "border-sky-200 bg-sky-50 text-sky-800"
  if (["declined", "expired", "failed"].includes(value)) return "border-red-200 bg-red-50 text-red-800"
  return "border-amber-200 bg-amber-50 text-amber-900"
}

function purposeLabel(value: string) {
  switch (value) {
    case "boost_order": return "VIP / Boost"
    case "ad_order": return "რეკლამა"
    case "sandbox_test": return "Validation"
    default: return value
  }
}


function flashLabel(value?: string) {
  switch (value) {
    case "flitt_check_approved": return "Flitt API-მ დაადასტურა: გადახდა approved არის."
    case "flitt_check_processing": return "Flitt API-მ გადაამოწმა ტრანზაქცია: სტატუსი ჯერ ისევ processing-ია."
    case "flitt_check_declined": return "Flitt API-მ დაადასტურა: გადახდა declined არის."
    case "flitt_check_expired": return "Flitt API-მ დაადასტურა: checkout ვადაგასულია."
    case "flitt_check_reversed": return "Flitt API-მ დაადასტურა: თანხა დაბრუნებულია."
    case "flitt_check_failed_status": return "Flitt API-მ დააბრუნა საბოლოო წარუმატებელი სტატუსი."
    case "flitt_check_invalid": return "ტრანზაქციის ID არასწორია."
    case "flitt_check_missing": return "ტრანზაქცია ვერ მოიძებნა."
    case "flitt_check_unsupported": return "ამ ჩანაწერზე provider check დაუშვებელია."
    case "flitt_check_error": return "Flitt provider status-ის გადამოწმება ვერ შესრულდა. Runtime logs-ში ჩაიწერა ტექნიკური მიზეზი."
    default: return ""
  }
}

function diagnoseAttempt(attempt: FlittAttempt) {
  const provider = String(attempt.provider_status ?? "").trim().toLowerCase()

  if (attempt.status === "approved") {
    return {
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      title: "გადახდა დადასტურებულია",
      detail: "SamoSell-ს აქვს საბოლოო approved სტატუსი. Approved verification ველში ჩანს როდის და რომელი server-side შემოწმებით დადასტურდა.",
    }
  }

  if (attempt.status === "reversed") {
    return {
      tone: "border-sky-200 bg-sky-50 text-sky-900",
      title: "თანხა დაბრუნებულია",
      detail: "Provider-ის საბოლოო მდგომარეობა reversed არის.",
    }
  }

  if (["declined", "expired", "failed"].includes(attempt.status)) {
    return {
      tone: "border-red-200 bg-red-50 text-red-900",
      title: "გადახდა საბოლოოდ ვერ დასრულდა",
      detail: `Provider status: ${attempt.provider_status || attempt.status}. ეს აღარ არის pending ტრანზაქცია.`,
    }
  }

  if (provider === "processing" && attempt.callback_count > 0) {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-950",
      title: "Callback მოვიდა, მაგრამ Flitt ჯერ processing-ს აბრუნებს",
      detail: "Response status = success ნიშნავს, რომ Flitt-ის პასუხი ტექნიკურად წარმატებით მივიღეთ — არა იმას, რომ თანხა approved გახდა. დააჭირე provider check-ს, რომ ახლანდელი საბოლოო სტატუსი პირდაპირ Flitt API-დან წამოვიღოთ.",
    }
  }

  if (attempt.callback_count === 0) {
    return {
      tone: "border-amber-200 bg-amber-50 text-amber-950",
      title: "Callback ჯერ არ მიგვიღია",
      detail: "ტრანზაქცია pending არის და server callback არ ჩანს. Provider check პირდაპირ Flitt-ის status API-ს ჰკითხავს მიმდინარე მდგომარეობას.",
    }
  }

  return {
    tone: "border-amber-200 bg-amber-50 text-amber-950",
    title: "ტრანზაქცია ჯერ pending არის",
    detail: "საბოლოო სტატუსი ჯერ არ არის დადასტურებული. გამოიყენე provider check, რათა Flitt API-დან ხელახლა გადამოწმდეს.",
  }
}

export const dynamic = "force-dynamic"
export const revalidate = 0

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams?: Promise<Params>
}) {
  const params = (await searchParams) ?? {}
  const requestedStatus = typeof params.status === "string" ? params.status : "all"
  const activeStatus = tabs.some(([key]) => key === requestedStatus)
    ? requestedStatus
    : "all"
  const requestedScope = typeof params.scope === "string" ? params.scope : "payments"
  const activeScope = scopeTabs.some(([key]) => key === requestedScope)
    ? requestedScope
    : "payments"
  const rawSearch = typeof params.q === "string" ? params.q : ""
  const search = rawSearch.trim().toLowerCase().slice(0, 120)
  const rawFlash = typeof params.flash === "string" ? params.flash : ""
  const flash = flashLabel(rawFlash)
  const referenceTime = new Date()
  const staleCutoff = new Date(
    referenceTime.getTime() - STALE_PAYMENT_MINUTES * 60 * 1000,
  ).toISOString()

  await requireAdminUser("/dashboard")
  const supabase = createAdminClient()

  let readiness: ReturnType<typeof getFlittReadiness> | null = null
  let flittConfigValid = true
  try {
    readiness = getFlittReadiness()
  } catch {
    flittConfigValid = false
  }

  const [
    attemptsResponse,
    totalResult,
    pendingResult,
    stalePendingResult,
    approvedResult,
    failedResult,
    reversedResult,
    validationResult,
  ] = await Promise.all([
    supabase
      .from("flitt_payment_attempts")
      .select(
        "id, order_id, user_id, mode, purpose, amount, currency, provider_payment_id, status, provider_status, response_status, callback_count, last_callback_at, provider_verified_at, provider_verification_source, boost_order_id, ad_order_id, created_at, updated_at",
      )
      .eq("mode", "live")
      .order("created_at", { ascending: false })
      .limit(250),
    supabase
      .from("flitt_payment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("mode", "live")
      .neq("purpose", "sandbox_test"),
    supabase
      .from("flitt_payment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("mode", "live")
      .neq("purpose", "sandbox_test")
      .eq("status", "pending"),
    supabase
      .from("flitt_payment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("mode", "live")
      .neq("purpose", "sandbox_test")
      .eq("status", "pending")
      .lte("created_at", staleCutoff),
    supabase
      .from("flitt_payment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("mode", "live")
      .neq("purpose", "sandbox_test")
      .eq("status", "approved"),
    supabase
      .from("flitt_payment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("mode", "live")
      .neq("purpose", "sandbox_test")
      .in("status", ["declined", "expired", "failed"]),
    supabase
      .from("flitt_payment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("mode", "live")
      .neq("purpose", "sandbox_test")
      .eq("status", "reversed"),
    supabase
      .from("flitt_payment_attempts")
      .select("id", { count: "exact", head: true })
      .eq("mode", "live")
      .eq("purpose", "sandbox_test"),
  ])

  const queryError =
    attemptsResponse.error ||
    totalResult.error ||
    pendingResult.error ||
    stalePendingResult.error ||
    approvedResult.error ||
    failedResult.error ||
    reversedResult.error ||
    validationResult.error

  let attempts = (attemptsResponse.data ?? []) as FlittAttempt[]

  if (activeScope === "payments") {
    attempts = attempts.filter((attempt) => attempt.purpose !== "sandbox_test")
  } else if (activeScope === "validation") {
    attempts = attempts.filter((attempt) => attempt.purpose === "sandbox_test")
  }

  if (activeStatus === "failed") {
    attempts = attempts.filter((attempt) =>
      ["declined", "expired", "failed"].includes(attempt.status),
    )
  } else if (activeStatus !== "all") {
    attempts = attempts.filter((attempt) => attempt.status === activeStatus)
  }

  if (search) {
    attempts = attempts.filter((attempt) =>
      [
        attempt.id,
        attempt.order_id,
        attempt.provider_payment_id,
        attempt.user_id,
        attempt.purpose,
        purposeLabel(attempt.purpose),
        attempt.status,
        attempt.provider_status,
        attempt.response_status,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(search),
    )
  }

  const productionReady =
    flittConfigValid &&
    readiness?.mode === "live" &&
    Boolean(readiness.liveEnabled) &&
    Boolean(readiness.productionDeployment)

  const currentQuery = new URLSearchParams()
  if (activeStatus !== "all") currentQuery.set("status", activeStatus)
  if (activeScope !== "payments") currentQuery.set("scope", activeScope)
  if (rawSearch) currentQuery.set("q", rawSearch)
  const currentPath = currentQuery.toString()
    ? `/admin/payments?${currentQuery.toString()}`
    : "/admin/payments"

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">Admin / Payments</div>
            <h1 className="mt-3 text-3xl font-black text-text sm:text-4xl">
              Flitt production გადახდები
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft">
              აქ ჩანს მხოლოდ Flitt-ის live ტრანზაქციები — VIP/Boost, რეკლამები და production validation. ძველი provider-ების ისტორია DB-ში ინახება, მაგრამ აქტიურ payment flow-ში აღარ მონაწილეობს.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/flitt-sandbox" className="ui-btn-primary">
              Flitt validation
            </Link>
            <Link href="/admin/system" className="ui-btn-secondary">
              System Status
            </Link>
            <Link href="/admin" className="ui-btn-secondary">
              ადმინის მთავარი
            </Link>
          </div>
        </div>

        <div className={
          productionReady
            ? "mt-5 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
            : "mt-5 rounded-[1.2rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
        }>
          <strong>Flitt production:</strong>{" "}
          {productionReady
            ? "LIVE / READY"
            : flittConfigValid
              ? `CHECK — mode: ${readiness?.mode ?? "unknown"}`
              : "CHECK — configuration invalid"}
        </div>
      </section>

      {flash ? (
        <div className="mt-6 rounded-[1.2rem] border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-900">
          {flash}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <StatCard label="რეალური LIVE" value={totalResult.count ?? 0} />
        <StatCard label="მოლოდინში" value={pendingResult.count ?? 0} />
        <StatCard label="30წთ+ stale" value={stalePendingResult.count ?? 0} />
        <StatCard label="წარმატებული" value={approvedResult.count ?? 0} />
        <StatCard label="წარუმატებელი" value={failedResult.count ?? 0} />
        <StatCard label="Validation" value={validationResult.count ?? 0} />
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px_auto]">
          <input
            name="q"
            defaultValue={rawSearch}
            className="ui-input"
            placeholder="Order ID, Payment ID, user, purpose…"
          />
          <select name="status" defaultValue={activeStatus} className="ui-input">
            {tabs.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <select name="scope" defaultValue={activeScope} className="ui-input">
            {scopeTabs.map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <button className="ui-btn-primary">გაფილტვრა</button>
        </form>

        <div className="mt-4 flex flex-wrap gap-2">
          {scopeTabs.map(([key, label]) => {
            const query = new URLSearchParams()
            if (activeStatus !== "all") query.set("status", activeStatus)
            if (key !== "payments") query.set("scope", key)
            if (rawSearch) query.set("q", rawSearch)
            const href = query.toString()
              ? `/admin/payments?${query.toString()}`
              : "/admin/payments"
            return (
              <Link
                key={key}
                href={href}
                className={activeScope === key ? "ui-pill-soft" : "ui-pill"}
              >
                {label}
              </Link>
            )
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {tabs.map(([key, label]) => {
            const query = new URLSearchParams()
            if (key !== "all") query.set("status", key)
            if (activeScope !== "payments") query.set("scope", activeScope)
            if (rawSearch) query.set("q", rawSearch)
            const href = query.toString()
              ? `/admin/payments?${query.toString()}`
              : "/admin/payments"
            return (
              <Link
                key={key}
                href={href}
                className={activeStatus === key ? "ui-pill-soft" : "ui-pill"}
              >
                {label}
              </Link>
            )
          })}
        </div>
      </section>

      {queryError ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Flitt payment data სრულად ვერ ჩაიტვირთა: {queryError.message}
        </div>
      ) : null}

      <section className="mt-6 space-y-4">
        {attempts.length ? attempts.map((attempt) => {
          const isStaleRealPayment =
            attempt.purpose !== "sandbox_test" &&
            attempt.status === "pending" &&
            new Date(attempt.created_at).getTime() <= new Date(staleCutoff).getTime()

          return (
          <article key={attempt.id} className="ui-card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(attempt.status)}`}>
                    {statusLabel(attempt.status)}
                  </span>
                  <span className="ui-pill !px-3 !py-1 text-xs">
                    {purposeLabel(attempt.purpose)}
                  </span>
                  <span className="ui-pill !px-3 !py-1 text-xs">
                    LIVE
                  </span>
                </div>
                <div className="mt-3 text-xl font-black text-text">
                  {formatAmount(attempt.amount, attempt.currency)}
                </div>
                <div className="mt-1 break-all font-mono text-xs text-text-soft">
                  Order: {attempt.order_id}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {attempt.status === "pending" ? (
                  <form action={refreshFlittPaymentAttemptAction}>
                    <input type="hidden" name="attemptId" value={attempt.id} />
                    <input type="hidden" name="nextPath" value={currentPath} />
                    <button className="ui-btn-primary">
                      Flitt-ში სტატუსის გადამოწმება
                    </button>
                  </form>
                ) : null}
                {attempt.boost_order_id ? (
                  <Link href="/admin/boosts" className="ui-btn-secondary">
                    Boost-ების მართვა
                  </Link>
                ) : null}
                {attempt.ad_order_id ? (
                  <Link href="/admin/ads" className="ui-btn-secondary">
                    რეკლამების მართვა
                  </Link>
                ) : null}
              </div>
            </div>

            <div className={`mt-4 rounded-[1.2rem] border px-4 py-3 text-sm ${diagnoseAttempt(attempt).tone}`}>
              <div className="font-black">{diagnoseAttempt(attempt).title}</div>
              <p className="mt-1 leading-6">{diagnoseAttempt(attempt).detail}</p>
              {attempt.purpose === "sandbox_test" ? (
                <p className="mt-2 text-xs font-semibold">
                  ეს არის production validation ტრანზაქცია — VIP/რეკლამის შეკვეთას არ უკავშირდება.
                </p>
              ) : null}
            </div>

            <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                <strong>Flitt Payment ID</strong>
                <div className="mt-1 break-all text-text-soft">
                  {attempt.provider_payment_id || "—"}
                </div>
              </div>
              <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                <strong>Provider status</strong>
                <div className="mt-1 text-text-soft">
                  {attempt.provider_status || "—"}
                </div>
              </div>
              <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                <strong>Response status</strong>
                <div className="mt-1 text-text-soft">
                  {attempt.response_status || "—"}
                </div>
              </div>
              <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                <strong>Callbacks</strong>
                <div className="mt-1 text-text-soft">
                  {attempt.callback_count ?? 0}
                </div>
              </div>
              <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                <strong>Approved verification</strong>
                <div className="mt-1 text-text-soft">
                  {formatDate(attempt.provider_verified_at)}
                </div>
              </div>
              <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                <strong>Approval verification source</strong>
                <div className="mt-1 text-text-soft">
                  {attempt.provider_verification_source || "—"}
                </div>
              </div>
              <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                <strong>Last callback</strong>
                <div className="mt-1 text-text-soft">
                  {formatDate(attempt.last_callback_at)}
                </div>
              </div>
              <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                <strong>Created</strong>
                <div className="mt-1 text-text-soft">
                  {formatDate(attempt.created_at)}
                </div>
              </div>
              <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                <strong>Last provider/DB sync</strong>
                <div className="mt-1 text-text-soft">
                  {formatDate(attempt.updated_at)}
                </div>
              </div>
            </div>
            {isStaleRealPayment ? (
              <div className="mt-4 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                <div className="font-black">30 წუთზე მეტი pending</div>
                <p className="mt-1 leading-6">
                  ეს უკვე ოპერაციული გაფრთხილებაა. ჯერ გამოიყენე „Flitt-ში სტატუსის გადამოწმება“. თუ provider კვლავ processing-ს აბრუნებს და მომხმარებელს თანხა ჩამოეჭრა, Payment ID-ით Flitt support/merchant portal-ში გადაამოწმე.
                </p>
              </div>
            ) : null}
          </article>
          )
        }) : (
          <div className="ui-card border-dashed p-8 text-sm leading-7 text-text-soft">
            ამ ფილტრებით Flitt live ტრანზაქცია ვერ მოიძებნა.
          </div>
        )}
      </section>
    </main>
  )
}
