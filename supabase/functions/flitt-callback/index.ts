import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// Sandbox-only Flitt webhook. Live mode must use production credentials/secrets
// and a separately reviewed deployment before it is enabled.
const MAX_BODY_BYTES = 32768;
const TEST_MERCHANT_ID = "1549901";
const TEST_SECRET = "test";

type AttemptStatus = "pending" | "approved" | "declined" | "expired" | "reversed" | "failed";
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

function nonEmpty(value: unknown) {
  return value !== undefined && value !== null && String(value) !== "";
}

async function sha1Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function buildSignature(params: CallbackParams, secret: string) {
  const keys = Object.keys(params)
    .filter((key) => key !== "signature" && key !== "response_signature_string" && nonEmpty(params[key]))
    .sort();
  const values = keys.map((key) => String(params[key]));
  return await sha1Hex([secret, ...values].join("|"));
}

async function verifySignature(params: CallbackParams, secret: string) {
  const provided = text(params.signature).trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(provided)) return false;
  const expected = await buildSignature(params, secret);
  return provided === expected;
}

function mapStatus(value: unknown): AttemptStatus {
  switch (text(value).trim().toLowerCase()) {
    case "approved": return "approved";
    case "declined": return "declined";
    case "expired": return "expired";
    case "reversed": return "reversed";
    case "created":
    case "processing": return "pending";
    default: return "failed";
  }
}

function resolveStatus(current: AttemptStatus, incoming: AttemptStatus): AttemptStatus {
  if (current === "reversed") return "reversed";
  if (incoming === "reversed") return "reversed";
  if (current === "approved") return "approved";
  if (["declined", "expired", "failed"].includes(current)) return current;
  return incoming;
}

async function parseBody(req: Request): Promise<CallbackParams> {
  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) throw new Error("callback_too_large");
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("invalid_json");
    const obj = parsed as Record<string, unknown>;
    if (obj.response && typeof obj.response === "object" && !Array.isArray(obj.response)) {
      return obj.response as CallbackParams;
    }
    return obj;
  }
  return Object.fromEntries(new URLSearchParams(raw).entries());
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    return json({ ok: true, provider: "flitt", mode: "test" });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let params: CallbackParams;
  try {
    params = await parseBody(req);
  } catch {
    return json({ error: "invalid_callback_body" }, 400);
  }

  const orderId = text(params.order_id).trim();
  if (!orderId || orderId.length > 1024) return json({ error: "invalid_order_id" }, 400);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "server_configuration_error" }, 503);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: attempt, error: lookupError } = await admin
    .from("flitt_payment_attempts")
    .select("order_id, boost_order_id, amount, currency, merchant_id, provider_payment_id, status, callback_count, mode, purpose")
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

  if (attempt.mode !== "test" || !["sandbox_test", "boost_order"].includes(attempt.purpose)) {
    return json({ error: "unsupported_attempt" }, 409);
  }
  if (String(attempt.merchant_id) !== TEST_MERCHANT_ID || text(params.merchant_id) !== TEST_MERCHANT_ID) {
    return json({ error: "merchant_mismatch" }, 400);
  }
  if (!(await verifySignature(params, TEST_SECRET))) {
    console.warn("[flitt-edge] invalid signature", { orderId });
    return json({ error: "invalid_signature" }, 400);
  }
  if (text(params.order_id) !== String(attempt.order_id)) return json({ error: "order_mismatch" }, 400);
  if (text(params.currency).toUpperCase() !== String(attempt.currency).toUpperCase()) return json({ error: "currency_mismatch" }, 400);
  if (Number(params.amount) !== Number(attempt.amount)) return json({ error: "amount_mismatch" }, 400);

  const callbackPaymentId = params.payment_id === undefined || params.payment_id === null ? null : String(params.payment_id);
  if (attempt.provider_payment_id && callbackPaymentId !== String(attempt.provider_payment_id)) {
    return json({ error: "payment_id_mismatch" }, 400);
  }

  const incoming = mapStatus(params.order_status);
  const nextStatus = resolveStatus(attempt.status as AttemptStatus, incoming);
  const now = new Date().toISOString();

  const { error: updateError } = await admin
    .from("flitt_payment_attempts")
    .update({
      provider_payment_id: attempt.provider_payment_id ?? callbackPaymentId,
      status: nextStatus,
      provider_status: text(params.order_status) || null,
      response_status: text(params.response_status) || null,
      callback_count: Number(attempt.callback_count ?? 0) + 1,
      last_callback_at: now,
      updated_at: now,
    })
    .eq("order_id", orderId);

  if (updateError) {
    console.error("[flitt-edge] persistence failed", { orderId, code: updateError.code });
    return json({ error: "callback_persistence_failed" }, 500);
  }

  if (attempt.purpose === "boost_order" && attempt.boost_order_id && nextStatus === "approved") {
    const { error: finalizeError } = await admin.rpc("finalize_flitt_boost_payment", { p_order_id: attempt.boost_order_id });
    if (finalizeError) {
      console.error("[flitt-edge] boost finalization failed", { orderId, code: finalizeError.code });
      return json({ error: "boost_activation_failed" }, 500);
    }
  }

  console.log("[flitt-edge] callback accepted", { orderId, nextStatus });
  return new Response("OK", { status: 200 });
});
