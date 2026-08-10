"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { isUuid } from "@/lib/listing-form"
import {
  canTransitionMarketplaceOrder,
  isMarketplaceOrderStatus,
  marketplaceOrderStatusLabel,
} from "@/lib/orders"
import { enforceRateLimit } from "@/lib/rate-limit"
import type { MarketplaceOrderRole, MarketplaceOrderStatus } from "@/types/order"

export type TransitionOrderInput = {
  orderId: string
  nextStatus: string
  expectedUpdatedAt: string
}

export type TransitionOrderResult =
  | {
      ok: true
      status: MarketplaceOrderStatus
      updatedAt: string
      message: string
    }
  | {
      ok: false
      code:
        | "unauthorized"
        | "invalid"
        | "not_found"
        | "conflict"
        | "rate_limited"
        | "server_error"
      message: string
    }

type ParticipantOrder = {
  id: string
  buyer_id: string | null
  seller_id: string | null
  status: string
  updated_at: string
  listing_slug: string
}

function getParticipantRole(order: ParticipantOrder, userId: string): MarketplaceOrderRole | null {
  if (order.buyer_id === userId) return "buyer"
  if (order.seller_id === userId) return "seller"
  return null
}

function successMessage(status: MarketplaceOrderStatus) {
  return `შეკვეთის სტატუსი განახლდა: ${marketplaceOrderStatusLabel(status)}.`
}

export async function transitionMarketplaceOrderAction(
  input: TransitionOrderInput,
): Promise<TransitionOrderResult> {
  const orderId = String(input?.orderId ?? "")
  const nextStatus = String(input?.nextStatus ?? "")
  const expectedUpdatedAt = String(input?.expectedUpdatedAt ?? "")

  if (
    !isUuid(orderId) ||
    !isMarketplaceOrderStatus(nextStatus) ||
    !expectedUpdatedAt ||
    Number.isNaN(new Date(expectedUpdatedAt).getTime())
  ) {
    return {
      ok: false,
      code: "invalid",
      message: "შეკვეთის ცვლილების მოთხოვნა არასწორია. განაახლე გვერდი და სცადე ხელახლა.",
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return {
      ok: false,
      code: "unauthorized",
      message: "სესია დასრულდა. თავიდან შედი ანგარიშში.",
    }
  }

  try {
    await enforceRateLimit(supabase, "order_status_update")
  } catch {
    return {
      ok: false,
      code: "rate_limited",
      message: "ძალიან ბევრი ცვლილება გაიგზავნა. ცოტა ხანში სცადე ხელახლა.",
    }
  }

  const { data: order, error: lookupError } = await supabase
    .from("marketplace_orders")
    .select("id, buyer_id, seller_id, status, updated_at, listing_slug")
    .eq("id", orderId)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .maybeSingle()

  if (lookupError) {
    console.error("marketplace_order_lookup_failed", lookupError.message)
    return {
      ok: false,
      code: "server_error",
      message: "შეკვეთის შემოწმება ვერ მოხერხდა. სცადე ხელახლა.",
    }
  }

  const participantOrder = order as ParticipantOrder | null
  if (!participantOrder) {
    return {
      ok: false,
      code: "not_found",
      message: "შეკვეთა ვერ მოიძებნა ან მისი შეცვლის უფლება არ გაქვს.",
    }
  }

  const role = getParticipantRole(participantOrder, user.id)
  if (
    !role ||
    !isMarketplaceOrderStatus(participantOrder.status) ||
    !canTransitionMarketplaceOrder(participantOrder.status, nextStatus, role)
  ) {
    return {
      ok: false,
      code: "invalid",
      message: "ამ სტატუსზე გადასვლა დაუშვებელია.",
    }
  }

  if (participantOrder.updated_at !== expectedUpdatedAt) {
    return {
      ok: false,
      code: "conflict",
      message: "შეკვეთა უკვე შეიცვალა. განაახლე გვერდი და სცადე ხელახლა.",
    }
  }

  const { data: updatedOrder, error: transitionError } = await supabase
    .rpc("transition_marketplace_order", {
      p_order_id: orderId,
      p_next_status: nextStatus,
      p_expected_updated_at: expectedUpdatedAt,
    })
    .maybeSingle()

  if (transitionError) {
    const isConflict = transitionError.code === "40001" || transitionError.message.includes("stale_order")
    const isInvalid = transitionError.code === "22023" || transitionError.message.includes("invalid_order_transition")

    if (!isConflict && !isInvalid) {
      console.error("marketplace_order_transition_failed", transitionError.message)
    }

    return {
      ok: false,
      code: isConflict ? "conflict" : isInvalid ? "invalid" : "server_error",
      message: isConflict
        ? "შეკვეთა უკვე შეიცვალა. განაახლე გვერდი და სცადე ხელახლა."
        : isInvalid
          ? "ამ სტატუსზე გადასვლა დაუშვებელია."
          : "შეკვეთის სტატუსი ვერ განახლდა. მონაცემები არ შეცვლილა.",
    }
  }

  if (
    !updatedOrder
  ) {
    return {
      ok: false,
      code: "not_found",
      message: "შეკვეთა ვერ მოიძებნა ან მისი შეცვლის უფლება არ გაქვს.",
    }
  }

  const transition = updatedOrder as {
    status?: unknown
    updated_at?: unknown
    listing_slug?: unknown
  }

  if (
    !isMarketplaceOrderStatus(transition.status) ||
    typeof transition.updated_at !== "string"
  ) {
    return {
      ok: false,
      code: "server_error",
      message: "შეკვეთის განახლებული მდგომარეობა ვერ დადასტურდა.",
    }
  }

  revalidatePath("/dashboard")
  revalidatePath("/dashboard/orders")
  revalidatePath("/catalog")
  if (typeof transition.listing_slug === "string" && transition.listing_slug) {
    revalidatePath(`/listing/${transition.listing_slug}`)
  }

  return {
    ok: true,
    status: transition.status,
    updatedAt: transition.updated_at,
    message: successMessage(transition.status),
  }
}
