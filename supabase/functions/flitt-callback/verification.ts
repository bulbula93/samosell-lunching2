export type FlittAttemptStatus = "pending" | "approved" | "declined" | "expired" | "reversed" | "failed";

export type FlittAttempt = {
  orderId: string;
  boostOrderId: string | null;
  adOrderId: string | null;
  amount: number;
  currency: string;
  merchantId: string;
  providerPaymentId: string | null;
  providerVerifiedAt: string | null;
  providerVerificationSource: string | null;
  status: FlittAttemptStatus;
  purpose: string;
};

export type FlittRuntimeConfig = {
  mode: "test";
  merchantId: string;
  secretKey: string;
  apiUrl: string;
};

export type VerifiedStatus = {
  paymentId: string | null;
  providerStatus: string;
  responseStatus: string;
  nextStatus: FlittAttemptStatus;
  approved: boolean;
};

type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export class FlittVerificationError extends Error {
  constructor(
    public readonly code: string,
    public readonly httpStatus: number,
  ) {
    super(code);
    this.name = "FlittVerificationError";
  }
}

function requiredEnv(getEnv: (name: string) => string | undefined, name: string) {
  const value = String(getEnv(name) ?? "").trim();
  if (!value) throw new FlittVerificationError("flitt_configuration_missing", 503);
  return value;
}

export function readFlittRuntimeConfig(getEnv: (name: string) => string | undefined): FlittRuntimeConfig {
  const mode = requiredEnv(getEnv, "FLITT_MODE").toLowerCase();
  if (mode !== "test") throw new FlittVerificationError("flitt_mode_not_test", 503);

  const merchantId = requiredEnv(getEnv, "FLITT_MERCHANT_ID");
  if (!/^\d{1,12}$/.test(merchantId)) {
    throw new FlittVerificationError("flitt_merchant_configuration_invalid", 503);
  }

  const secretKey = requiredEnv(getEnv, "FLITT_SECRET_KEY");
  const configuredApiUrl = requiredEnv(getEnv, "FLITT_API_URL");
  let apiUrl: URL;
  try {
    apiUrl = new URL(configuredApiUrl);
  } catch {
    throw new FlittVerificationError("flitt_api_configuration_invalid", 503);
  }
  if (apiUrl.protocol !== "https:" || apiUrl.username || apiUrl.password) {
    throw new FlittVerificationError("flitt_api_configuration_invalid", 503);
  }

  return {
    mode: "test",
    merchantId,
    secretKey,
    apiUrl: apiUrl.toString().replace(/\/$/, ""),
  };
}

function text(value: unknown) {
  return value === undefined || value === null ? "" : String(value);
}

function nonEmpty(value: unknown) {
  return value !== undefined && value !== null && String(value) !== "";
}

export async function buildFlittSignature(params: Record<string, unknown>, secretKey: string) {
  const values = Object.keys(params)
    .filter((key) => key !== "signature" && key !== "response_signature_string" && nonEmpty(params[key]))
    .sort()
    .map((key) => String(params[key]));
  const payload = new TextEncoder().encode([secretKey, ...values].join("|"));
  const digest = await crypto.subtle.digest("SHA-1", payload);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function verifyFlittSignature(params: Record<string, unknown>, secretKey: string) {
  const provided = text(params.signature).trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(provided)) return false;
  const expected = await buildFlittSignature(params, secretKey);
  let mismatch = provided.length ^ expected.length;
  for (let index = 0; index < Math.max(provided.length, expected.length); index += 1) {
    mismatch |= (provided.charCodeAt(index) || 0) ^ (expected.charCodeAt(index) || 0);
  }
  return mismatch === 0;
}

function mapStatus(value: unknown): FlittAttemptStatus {
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

export function resolveStatus(current: FlittAttemptStatus, incoming: FlittAttemptStatus): FlittAttemptStatus {
  if (current === "reversed" || incoming === "reversed") return "reversed";
  if (current === "approved") return "approved";
  if (["declined", "expired", "failed"].includes(current)) return current;
  return incoming;
}

function verifyIdentity(
  params: Record<string, unknown>,
  attempt: FlittAttempt,
  config: FlittRuntimeConfig,
) {
  if (attempt.merchantId !== config.merchantId) {
    throw new FlittVerificationError("attempt_merchant_mismatch", 400);
  }
  if (text(params.merchant_id) !== config.merchantId) {
    throw new FlittVerificationError("merchant_mismatch", 400);
  }
  if (text(params.order_id) !== attempt.orderId) {
    throw new FlittVerificationError("order_mismatch", 400);
  }
  if (text(params.currency).toUpperCase() !== attempt.currency.toUpperCase()) {
    throw new FlittVerificationError("currency_mismatch", 400);
  }
  if (!Number.isInteger(Number(params.amount)) || Number(params.amount) !== attempt.amount) {
    throw new FlittVerificationError("amount_mismatch", 400);
  }

  const paymentId = params.payment_id === undefined || params.payment_id === null
    ? null
    : String(params.payment_id);
  if (attempt.providerPaymentId && paymentId !== attempt.providerPaymentId) {
    throw new FlittVerificationError("payment_id_mismatch", 400);
  }
  return paymentId;
}

export async function validateIncomingCallback(
  params: Record<string, unknown>,
  attempt: FlittAttempt,
  config: FlittRuntimeConfig,
) {
  if (!(await verifyFlittSignature(params, config.secretKey))) {
    throw new FlittVerificationError("invalid_callback_signature", 400);
  }
  return verifyIdentity(params, attempt, config);
}

export async function fetchAuthoritativeFlittStatus(
  attempt: FlittAttempt,
  config: FlittRuntimeConfig,
  fetchImpl: FetchLike = fetch,
): Promise<VerifiedStatus> {
  const requestParams: Record<string, unknown> = {
    version: "1.0.1",
    order_id: attempt.orderId,
    merchant_id: Number(config.merchantId),
  };
  requestParams.signature = await buildFlittSignature(requestParams, config.secretKey);

  let response: Response;
  try {
    response = await fetchImpl(`${config.apiUrl}/api/status/order_id`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ request: requestParams }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new FlittVerificationError("status_api_unavailable", 503);
  }

  let body: unknown;
  try {
    body = JSON.parse(await response.text());
  } catch {
    throw new FlittVerificationError("status_api_invalid_json", 502);
  }
  const params = body && typeof body === "object" && !Array.isArray(body)
    ? (body as { response?: unknown }).response
    : null;
  if (!response.ok || !params || typeof params !== "object" || Array.isArray(params)) {
    throw new FlittVerificationError("status_api_invalid_response", response.ok ? 502 : 503);
  }

  const statusParams = params as Record<string, unknown>;
  if (!(await verifyFlittSignature(statusParams, config.secretKey))) {
    throw new FlittVerificationError("invalid_status_signature", 502);
  }
  if (text(statusParams.response_status).trim().toLowerCase() !== "success") {
    throw new FlittVerificationError("status_response_not_success", 502);
  }

  const paymentId = verifyIdentity(statusParams, attempt, config);
  const incomingStatus = mapStatus(statusParams.order_status);
  const nextStatus = resolveStatus(attempt.status, incomingStatus);
  return {
    paymentId,
    providerStatus: text(statusParams.order_status),
    responseStatus: text(statusParams.response_status),
    nextStatus,
    approved: incomingStatus === "approved" && nextStatus === "approved",
  };
}

export async function processFlittCallback(params: Record<string, unknown>, attempt: FlittAttempt, config: FlittRuntimeConfig, deps: {
  fetchImpl?: FetchLike;
  persist: (status: VerifiedStatus) => Promise<void>;
  finalize: (boostOrderId: string) => Promise<void>;
  reverse: (boostOrderId: string) => Promise<void>;
  finalizeAd?: (adOrderId: string) => Promise<void>;
  reverseAd?: (adOrderId: string) => Promise<void>;
  failAd?: (adOrderId: string) => Promise<void>;
}) {
  await validateIncomingCallback(params, attempt, config);
  const verified = await fetchAuthoritativeFlittStatus(attempt, config, deps.fetchImpl);
  await deps.persist(verified);

  if (verified.approved && attempt.purpose === "boost_order" && attempt.boostOrderId) {
    await deps.finalize(attempt.boostOrderId);
  }
  if (verified.nextStatus === "reversed" && attempt.purpose === "boost_order" && attempt.boostOrderId) {
    await deps.reverse(attempt.boostOrderId);
  }
  if (verified.approved && attempt.purpose === "ad_order" && attempt.adOrderId) {
    if (!deps.finalizeAd) throw new FlittVerificationError("ad_finalizer_unavailable", 500);
    await deps.finalizeAd(attempt.adOrderId);
  }
  if (verified.nextStatus === "reversed" && attempt.purpose === "ad_order" && attempt.adOrderId) {
    if (!deps.reverseAd) throw new FlittVerificationError("ad_reversal_handler_unavailable", 500);
    await deps.reverseAd(attempt.adOrderId);
  }
  if (["declined", "expired", "failed"].includes(verified.nextStatus)
    && attempt.purpose === "ad_order"
    && attempt.adOrderId) {
    if (!deps.failAd) throw new FlittVerificationError("ad_failure_handler_unavailable", 500);
    await deps.failAd(attempt.adOrderId);
  }
  return verified;
}
