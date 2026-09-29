import Link from "next/link"
import StatCard from "@/components/shared/StatCard"
import { requireAdminUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import { getTbcCheckoutReadiness } from "@/lib/tbc"
import { getTbcAdminLiveTestReadiness } from "@/lib/tbc-admin-live-test"
import {
  refundTbcAdminLiveTestAction,
  startTbcAdminLiveTestAction,
  syncTbcAdminLiveTestAction,
} from "./actions"

type LiveTestAttempt = {
  id: string
  admin_id: string
  amount: number
  currency: string
  status: string
  provider_payment_id: string | null
  provider_status: string | null
  provider_result_code: string | null
  failure_reason: string | null
  callback_received_at: string | null
  paid_at: string | null
  refund_requested_at: string | null
  refunded_at: string | null
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

function formatDate(value?: string | null) {
  if (!value) return "—"
  return new Intl.DateTimeFormat("ka-GE", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Asia/Tbilisi",
  }).format(new Date(value))
}

function statusLabel(status: string) {
  switch (status) {
    case "created":
      return "შექმნილია"
    case "checkout_ready":
      return "Checkout მზადაა"
    case "succeeded":
      return "Succeeded"
    case "failed":
      return "Failed"
    case "expired":
      return "Expired"
    case "verification_failed":
      return "Verification failed"
    case "create_failed":
      return "Create failed"
    case "refund_processing":
      return "Refund მუშავდება"
    case "returned":
      return "Returned"
    case "partial_returned":
      return "Partial returned"
    default:
      return status
  }
}

function statusClass(status: string) {
  if (status === "succeeded") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800"
  }
  if (status === "returned") {
    return "border-sky-200 bg-sky-50 text-sky-800"
  }
  if (
    status === "failed" ||
    status === "verification_failed" ||
    status === "create_failed" ||
    status === "partial_returned"
  ) {
    return "border-red-200 bg-red-50 text-red-800"
  }
  return "border-amber-200 bg-amber-50 text-amber-900"
}

export const dynamic = "force-dynamic"

export default async function TbcAdminLiveTestPage({
  searchParams,
}: {
  searchParams?: Promise<{
    ok?: string | string[]
    error?: string | string[]
    attempt?: string | string[]
  }>
}) {
  const params = (await searchParams) ?? {}
  const ok = typeof params.ok === "string" ? params.ok : ""
  const error = typeof params.error === "string" ? params.error : ""
  const highlightedAttempt =
    typeof params.attempt === "string" ? params.attempt : ""

  await requireAdminUser("/dashboard")

  const readiness = getTbcAdminLiveTestReadiness()
  const consumerCheckout = getTbcCheckoutReadiness()
  const configurationReady =
    readiness.apiKeyPresent &&
    readiness.clientIdPresent &&
    readiness.clientSecretPresent &&
    readiness.siteUrlIsProduction

  const admin = createAdminClient()
  const { data, error: queryError } = await admin
    .from("tbc_live_test_attempts")
    .select(
      "id, admin_id, amount, currency, status, provider_payment_id, provider_status, provider_result_code, failure_reason, callback_received_at, paid_at, refund_requested_at, refunded_at, last_synced_at, created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(20)

  const attempts = (data ?? []) as LiveTestAttempt[]
  const succeeded = attempts.filter(
    (item) => item.provider_status === "Succeeded" && item.paid_at,
  ).length
  const returned = attempts.filter(
    (item) => item.provider_status === "Returned" && item.refunded_at,
  ).length

  return (
    <main className="ui-container ui-section">
      <section className="ui-card p-6 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-3xl">
            <div className="ui-eyebrow">Admin / Payments / TBC Live Test</div>
            <h1 className="mt-3 text-3xl font-black tracking-tight text-text sm:text-4xl">
              TBC 1 ₾ live test
            </h1>
            <p className="mt-3 text-sm leading-7 text-text-soft sm:text-base">
              იზოლირებული production ტესტია. ქმნის ზუსტად 1.00 ₾ TBC გადახდას,
              ამოწმებს payId / callback / provider status-ს და წარმატებული
              ტესტის შემდეგ გაძლევს 1 ₾ refund-ის გაშვების საშუალებას.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link href="/admin/payments/readiness" className="ui-btn-secondary">
              TBC readiness
            </Link>
            <Link href="/admin/payments" className="ui-btn-secondary">
              გადახდები
            </Link>
          </div>
        </div>
      </section>

      {ok ? (
        <div className="mt-6 rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {ok}
        </div>
      ) : null}

      {error ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="ტესტის თანხა" value="1.00 ₾" />
        <StatCard label="Succeeded" value={succeeded} />
        <StatCard label="Returned" value={returned} />
        <StatCard
          label="Public TBC Checkout"
          value={consumerCheckout.featureFlagEnabled ? "ON" : "OFF"}
        />
      </section>

      <section className="ui-card mt-6 p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            <h2 className="text-xl font-black text-text">ტესტის გაშვება</h2>
            <p className="mt-2 text-sm leading-7 text-text-soft">
              ღილაკზე დაჭერის შემდეგ TBC-ის რეალურ checkout-ზე გადახვალ.
              ბარათიდან ჩამოგეჭრება მხოლოდ <strong>1.00 ₾</strong>. წარმატებული
              დაბრუნების შემდეგ ამავე გვერდზე გამოჩნდება Refund ღილაკი.
            </p>

            <div className="mt-4 rounded-[1.1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              ჩვეულებრივი მომხმარებლებისთვის TBC Checkout ამ ტესტით არ ირთვება.
              მიმდინარე public flag არის{" "}
              <strong>
                {consumerCheckout.featureFlagEnabled ? "ON" : "OFF"}
              </strong>.
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-line bg-surface-alt p-4">
            <div className="text-sm font-bold text-text">Readiness</div>
            <div className="mt-3 space-y-2 text-sm text-text-soft">
              <div>API key: {readiness.apiKeyPresent ? "✓" : "✕"}</div>
              <div>Client ID: {readiness.clientIdPresent ? "✓" : "✕"}</div>
              <div>
                Client Secret: {readiness.clientSecretPresent ? "✓" : "✕"}
              </div>
              <div>
                Production URL: {readiness.siteUrlIsProduction ? "✓" : "✕"}
              </div>
            </div>

            <form action={startTbcAdminLiveTestAction} className="mt-4">
              <button
                disabled={!configurationReady}
                className="ui-btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              >
                1 ₾ TBC live test-ის დაწყება
              </button>
            </form>
          </div>
        </div>
      </section>

      {queryError ? (
        <div className="mt-6 rounded-[1.2rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          Live test history ვერ ჩაიტვირთა: {queryError.message}
        </div>
      ) : null}

      <section className="mt-6 space-y-4">
        {attempts.length ? (
          attempts.map((attempt) => {
            const canRefund =
              attempt.status === "succeeded" &&
              attempt.provider_status === "Succeeded" &&
              Boolean(attempt.paid_at) &&
              !attempt.refunded_at

            return (
              <article
                key={attempt.id}
                className={
                  highlightedAttempt === attempt.id
                    ? "ui-card border-2 border-sky-300 p-5 sm:p-6"
                    : "ui-card p-5 sm:p-6"
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-bold ${statusClass(attempt.status)}`}
                      >
                        {statusLabel(attempt.status)}
                      </span>
                      <span className="ui-pill !px-3 !py-1 text-xs">
                        {attempt.amount} {attempt.currency === "GEL" ? "₾" : attempt.currency}
                      </span>
                    </div>

                    <div className="mt-3 font-mono text-xs text-text-soft">
                      Attempt: {attempt.id}
                    </div>
                    <div className="mt-1 break-all text-sm text-text-soft">
                      TBC Payment ID: {attempt.provider_payment_id || "—"}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {attempt.provider_payment_id ? (
                      <form action={syncTbcAdminLiveTestAction}>
                        <input type="hidden" name="attemptId" value={attempt.id} />
                        <button className="ui-btn-secondary">
                          Refresh status
                        </button>
                      </form>
                    ) : null}

                    {canRefund ? (
                      <form action={refundTbcAdminLiveTestAction}>
                        <input type="hidden" name="attemptId" value={attempt.id} />
                        <button className="ui-btn-primary">
                          Refund 1 ₾
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>

                <div className="mt-4 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                    <strong>Provider status:</strong>
                    <div className="mt-1 text-text-soft">
                      {attempt.provider_status || "—"}
                    </div>
                  </div>
                  <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                    <strong>Callback:</strong>
                    <div className="mt-1 text-text-soft">
                      {formatDate(attempt.callback_received_at)}
                    </div>
                  </div>
                  <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                    <strong>Paid:</strong>
                    <div className="mt-1 text-text-soft">
                      {formatDate(attempt.paid_at)}
                    </div>
                  </div>
                  <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                    <strong>Refunded:</strong>
                    <div className="mt-1 text-text-soft">
                      {formatDate(attempt.refunded_at)}
                    </div>
                  </div>
                  <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                    <strong>Refund requested:</strong>
                    <div className="mt-1 text-text-soft">
                      {formatDate(attempt.refund_requested_at)}
                    </div>
                  </div>
                  <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                    <strong>Last sync:</strong>
                    <div className="mt-1 text-text-soft">
                      {formatDate(attempt.last_synced_at)}
                    </div>
                  </div>
                  <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                    <strong>Created:</strong>
                    <div className="mt-1 text-text-soft">
                      {formatDate(attempt.created_at)}
                    </div>
                  </div>
                  <div className="rounded-[1rem] bg-surface-alt px-4 py-3">
                    <strong>Result code:</strong>
                    <div className="mt-1 text-text-soft">
                      {attempt.provider_result_code || "—"}
                    </div>
                  </div>
                </div>

                {attempt.failure_reason ? (
                  <div className="mt-4 rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    {attempt.failure_reason}
                  </div>
                ) : null}
              </article>
            )
          })
        ) : (
          <div className="ui-card border-dashed p-8 text-sm leading-7 text-text-soft">
            ჯერ 1 ₾ TBC live test არ ჩატარებულა.
          </div>
        )}
      </section>
    </main>
  )
}
