"use server"

import { randomUUID } from "crypto"
import { revalidatePath } from "next/cache"
import { redirect, unstable_rethrow } from "next/navigation"
import { requireAdminUser } from "@/lib/auth"
import { createAdminClient } from "@/lib/supabase/admin"
import {
  cancelTbcAdminLiveTestPayment,
  createTbcAdminLiveTestPayment,
  syncTbcAdminLiveTestByAttemptId,
} from "@/lib/tbc-admin-live-test"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function liveTestRedirect(kind: "ok" | "error", message: string): never {
  const params = new URLSearchParams({ [kind]: message })
  redirect(`/admin/payments/tbc-live-test?${params.toString()}`)
}

function safeProviderError(error: unknown) {
  const value = error instanceof Error ? error.message : "unknown error"
  return value.slice(0, 1000)
}

export async function startTbcAdminLiveTestAction() {
  const { user } = await requireAdminUser("/dashboard")
  const admin = createAdminClient()
  const attemptId = randomUUID()

  const { error: insertError } = await admin
    .from("tbc_live_test_attempts")
    .insert({
      id: attemptId,
      admin_id: user.id,
      amount: 1,
      currency: "GEL",
      status: "created",
    })

  if (insertError) {
    liveTestRedirect("error", "TBC live test attempt ვერ შეიქმნა.")
  }

  try {
    const { data, approvalUrl } =
      await createTbcAdminLiveTestPayment(attemptId)
    const now = new Date().toISOString()

    const { error: updateError } = await admin
      .from("tbc_live_test_attempts")
      .update({
        status: "checkout_ready",
        provider_payment_id: data.payId ?? null,
        provider_checkout_url: approvalUrl,
        provider_status: data.status ?? "Created",
        provider_result_code: data.resultCode ?? null,
        last_synced_at: now,
        updated_at: now,
      })
      .eq("id", attemptId)
      .eq("admin_id", user.id)

    if (updateError) throw updateError

    redirect(approvalUrl)
  } catch (error) {
    unstable_rethrow(error)
    const now = new Date().toISOString()
    await admin
      .from("tbc_live_test_attempts")
      .update({
        status: "create_failed",
        failure_reason: safeProviderError(error),
        updated_at: now,
      })
      .eq("id", attemptId)
      .eq("admin_id", user.id)

    console.error(
      "[tbc-live-test] checkout creation failed",
      safeProviderError(error),
    )
    liveTestRedirect(
      "error",
      "TBC 1 ₾ checkout ვერ შეიქმნა. თანხა არ ჩამოგეჭრა.",
    )
  }
}

export async function syncTbcAdminLiveTestAction(formData: FormData) {
  const attemptId = String(formData.get("attemptId") ?? "").trim()
  if (!UUID_PATTERN.test(attemptId)) {
    liveTestRedirect("error", "Live test attempt ID არასწორია.")
  }

  await requireAdminUser("/dashboard")

  try {
    const result = await syncTbcAdminLiveTestByAttemptId(attemptId)
    revalidatePath("/admin/payments/tbc-live-test")

    if (result.status === "succeeded") {
      liveTestRedirect("ok", "TBC 1 ₾ გადახდა დადასტურდა — Succeeded.")
    }
    if (result.status === "returned") {
      liveTestRedirect("ok", "TBC 1 ₾ სრულად დაბრუნებულია.")
    }
    if (result.status === "partial_returned") {
      liveTestRedirect(
        "error",
        "TBC-მ ნაწილობრივი დაბრუნება დააფიქსირა — ხელით გადაამოწმე.",
      )
    }

    liveTestRedirect(
      "ok",
      `TBC სტატუსი განახლდა: ${result.providerStatus || result.status}.`,
    )
  } catch (error) {
    unstable_rethrow(error)
    console.error(
      "[tbc-live-test] manual sync failed",
      safeProviderError(error),
    )
    liveTestRedirect("error", "TBC სტატუსის გადამოწმება ვერ შესრულდა.")
  }
}

export async function refundTbcAdminLiveTestAction(formData: FormData) {
  const attemptId = String(formData.get("attemptId") ?? "").trim()
  if (!UUID_PATTERN.test(attemptId)) {
    liveTestRedirect("error", "Live test attempt ID არასწორია.")
  }

  const { user } = await requireAdminUser("/dashboard")
  const admin = createAdminClient()

  const { data: attempt, error } = await admin
    .from("tbc_live_test_attempts")
    .select(
      "id, admin_id, status, provider_status, provider_payment_id, paid_at, refunded_at",
    )
    .eq("id", attemptId)
    .maybeSingle()

  if (error || !attempt) {
    liveTestRedirect("error", "TBC live test attempt ვერ მოიძებნა.")
  }

  if (
    attempt.status !== "succeeded" ||
    attempt.provider_status !== "Succeeded" ||
    !attempt.paid_at ||
    !attempt.provider_payment_id ||
    attempt.refunded_at
  ) {
    liveTestRedirect(
      "error",
      "Refund მხოლოდ დადასტურებული Succeeded 1 ₾ ტესტისთვის შეიძლება.",
    )
  }

  try {
    await cancelTbcAdminLiveTestPayment(
      String(attempt.provider_payment_id),
    )
    const now = new Date().toISOString()

    const { error: updateError } = await admin
      .from("tbc_live_test_attempts")
      .update({
        status: "refund_processing",
        refund_requested_at: now,
        updated_at: now,
      })
      .eq("id", attempt.id)

    if (updateError) throw updateError

    revalidatePath("/admin/payments/tbc-live-test")
    liveTestRedirect(
      "ok",
      "1 ₾ refund მოთხოვნა TBC-ს გაეგზავნა. რამდენიმე წამში გადაამოწმე სტატუსი.",
    )
  } catch (providerError) {
    unstable_rethrow(providerError)
    console.error(
      "[tbc-live-test] refund failed",
      safeProviderError(providerError),
    )
    liveTestRedirect(
      "error",
      "TBC refund მოთხოვნა ვერ შესრულდა. თანხის სტატუსი ხელით გადაამოწმე.",
    )
  }
}
