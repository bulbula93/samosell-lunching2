import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  FlittVerificationError,
  processFlittCallback,
  readFlittRuntimeConfig,
  type FlittAttemptStatus,
} from "./verification.ts";
import { readDefaultSupabaseSecretKey } from "../_shared/supabase-secret.ts";
import { CallbackBodyError, parseCallbackBody } from "./body.ts";

// Sandbox-only Flitt webhook. Live mode must use production credentials/secrets
// and a separately reviewed deployment before it is enabled.
type CallbackParams = Record<string, unknown>;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function text(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return json({ ok: true, provider: "flitt", mode: "test" });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let params: CallbackParams;
  try {
    params = await parseCallbackBody(req);
  } catch (error) {
    const failure = error instanceof CallbackBodyError
      ? error
      : new CallbackBodyError("invalid_callback_body", 400);
    return json({ error: failure.code }, failure.httpStatus);
  }

  const orderId = text(params.order_id).trim();
  if (!orderId || orderId.length > 1024) return json({ error: "invalid_order_id" }, 400);

  let config;
  try {
    config = readFlittRuntimeConfig((name) => Deno.env.get(name));
  } catch (error) {
    const code = error instanceof FlittVerificationError ? error.code : "flitt_configuration_error";
    console.error("[flitt-edge] configuration unavailable", { code });
    return json({ error: code }, 503);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  let secretKey: string;
  try {
    secretKey = readDefaultSupabaseSecretKey(Deno.env.get("SUPABASE_SECRET_KEYS"));
  } catch (error) {
    console.error("[flitt-edge] Supabase configuration unavailable", {
      code: error instanceof Error ? error.message : "supabase_configuration_error",
    });
    return json({ error: "server_configuration_error" }, 503);
  }
  if (!supabaseUrl) return json({ error: "server_configuration_error" }, 503);
  const admin = createClient(supabaseUrl, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: attempt, error: lookupError } = await admin
    .from("flitt_payment_attempts")
    .select("order_id, boost_order_id, ad_order_id, amount, currency, merchant_id, provider_payment_id, provider_verified_at, provider_verification_source, status, callback_count, mode, purpose")
    .eq("order_id", orderId)
    .maybeSingle();

  if (lookupError) {
    console.error("[flitt-edge] lookup failed", { orderId, code: lookupError.code });
    return json({ error: "callback_lookup_failed" }, 500);
  }
  if (!attempt) {
    console.warn("[flitt-edge] unknown order", { orderId });
    return new Response("OK", { status: 200 });
  }

  if (attempt.mode !== config.mode || !["sandbox_test", "boost_order", "ad_order"].includes(attempt.purpose)) {
    return json({ error: "unsupported_attempt" }, 409);
  }

  let verifiedStatus: FlittAttemptStatus | null = null;
  try {
    await processFlittCallback(params, {
      orderId: String(attempt.order_id),
      boostOrderId: attempt.boost_order_id ? String(attempt.boost_order_id) : null,
      adOrderId: attempt.ad_order_id ? String(attempt.ad_order_id) : null,
      amount: Number(attempt.amount),
      currency: String(attempt.currency),
      merchantId: String(attempt.merchant_id),
      providerPaymentId: attempt.provider_payment_id ? String(attempt.provider_payment_id) : null,
      providerVerifiedAt: attempt.provider_verified_at ? String(attempt.provider_verified_at) : null,
      providerVerificationSource: attempt.provider_verification_source ? String(attempt.provider_verification_source) : null,
      status: attempt.status as FlittAttemptStatus,
      purpose: String(attempt.purpose),
    }, config, {
      persist: async (status) => {
        verifiedStatus = status.nextStatus;
        const now = new Date().toISOString();
        const { error: updateError } = await admin
          .from("flitt_payment_attempts")
          .update({
            provider_payment_id: attempt.provider_payment_id ?? status.paymentId,
            status: status.nextStatus,
            provider_status: status.providerStatus || null,
            response_status: status.responseStatus || null,
            provider_verified_at: status.approved ? now : null,
            provider_verification_source: status.approved ? "status_api" : null,
            callback_count: Number(attempt.callback_count ?? 0) + 1,
            last_callback_at: now,
            updated_at: now,
          })
          .eq("order_id", orderId);
        if (updateError) throw new FlittVerificationError("callback_persistence_failed", 500);
      },
      finalize: async (boostOrderId) => {
        const { error: finalizeError } = await admin.rpc("finalize_flitt_boost_payment", { p_order_id: boostOrderId });
        if (finalizeError) throw new FlittVerificationError("boost_activation_failed", 500);
      },
      reverse: async (boostOrderId) => {
        const { error: reverseError } = await admin.rpc("reverse_flitt_boost_payment", { p_order_id: boostOrderId });
        if (reverseError) throw new FlittVerificationError("boost_reversal_failed", 500);
      },
      finalizeAd: async (adOrderId) => {
        const { error: finalizeError } = await admin.rpc("finalize_flitt_ad_payment", { p_order_id: adOrderId });
        if (finalizeError) throw new FlittVerificationError("ad_payment_finalization_failed", 500);
      },
      reverseAd: async (adOrderId) => {
        const { error: reverseError } = await admin.rpc("reverse_flitt_ad_payment", { p_order_id: adOrderId });
        if (reverseError) throw new FlittVerificationError("ad_reversal_failed", 500);
      },
      failAd: async (adOrderId) => {
        const { error: failureError } = await admin.rpc("fail_flitt_ad_payment", { p_order_id: adOrderId });
        if (failureError) throw new FlittVerificationError("ad_payment_failure_reconciliation_failed", 500);
      },
    });
  } catch (error) {
    const failure = error instanceof FlittVerificationError
      ? error
      : new FlittVerificationError("callback_processing_failed", 500);
    if (!verifiedStatus) {
      const now = new Date().toISOString();
      await admin
        .from("flitt_payment_attempts")
        .update({
          callback_count: Number(attempt.callback_count ?? 0) + 1,
          last_callback_at: now,
          updated_at: now,
        })
        .eq("order_id", orderId);
    }
    console.warn("[flitt-edge] callback not authorized", { orderId, code: failure.code });
    return json({ error: failure.code }, failure.httpStatus);
  }

  console.log("[flitt-edge] callback verified", { orderId, status: verifiedStatus });
  return new Response("OK", { status: 200 });
});
