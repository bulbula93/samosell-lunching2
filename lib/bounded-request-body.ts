export class BoundedBodyError extends Error {
  constructor(
    public readonly code: "payload_too_large" | "invalid_body",
    public readonly httpStatus: 400 | 413,
  ) {
    super(code)
    this.name = "BoundedBodyError"
  }
}

export async function readBoundedRequestBody(request: Request, maxBytes: number) {
  const contentLength = request.headers.get("content-length")
  if (contentLength && /^\d+$/.test(contentLength.trim()) && Number(contentLength) > maxBytes) {
    throw new BoundedBodyError("payload_too_large", 413)
  }
  if (!request.body) return ""

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel("payload_too_large").catch(() => undefined)
        throw new BoundedBodyError("payload_too_large", 413)
      }
      chunks.push(value)
    }
  } finally {
    reader.releaseLock()
  }

  const body = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(body)
  } catch {
    throw new BoundedBodyError("invalid_body", 400)
  }
}
