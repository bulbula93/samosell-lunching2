export const MAX_BODY_BYTES = 32768;

export class CallbackBodyError extends Error {
  constructor(
    public readonly code: "callback_too_large" | "invalid_callback_body",
    public readonly httpStatus: 400 | 413,
  ) {
    super(code);
    this.name = "CallbackBodyError";
  }
}

export async function readBoundedBody(req: Request, maxBytes: number): Promise<string> {
  const contentLength = req.headers.get("content-length");
  if (contentLength && /^\d+$/.test(contentLength.trim()) && Number(contentLength) > maxBytes) {
    throw new CallbackBodyError("callback_too_large", 413);
  }
  if (!req.body) return "";

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("callback_too_large").catch(() => undefined);
        throw new CallbackBodyError("callback_too_large", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CallbackBodyError("invalid_callback_body", 400);
  }
}

export async function parseCallbackBody(req: Request): Promise<Record<string, unknown>> {
  const raw = await readBoundedBody(req, MAX_BODY_BYTES);
  const contentType = req.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/json")) {
      const parsed = JSON.parse(raw) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new CallbackBodyError("invalid_callback_body", 400);
      }
      const obj = parsed as Record<string, unknown>;
      if (obj.response && typeof obj.response === "object" && !Array.isArray(obj.response)) {
        return obj.response as Record<string, unknown>;
      }
      return obj;
    }
    return Object.fromEntries(new URLSearchParams(raw).entries());
  } catch (error) {
    if (error instanceof CallbackBodyError) throw error;
    throw new CallbackBodyError("invalid_callback_body", 400);
  }
}
