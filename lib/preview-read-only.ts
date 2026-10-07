// This flag is scoped to the owner's review Preview, never enabled in Production.
export function isReadOnlyPreview() { return process.env.NEXT_PUBLIC_PREVIEW_READ_ONLY === "true" && process.env.VERCEL_ENV !== "production" }
export const previewSafeFetch: typeof fetch = async (input, init) => {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase()
  if (isReadOnlyPreview() && !["GET", "HEAD", "OPTIONS"].includes(method)) return Response.json({ message: "ეს Preview მხოლოდ სანახავად არის. ცვლილებების შესამოწმებლად იზოლირებული ბაზაა საჭირო.", code: "preview_read_only" }, { status: 403 })
  return fetch(input, init)
}
export function previewFetchOptions() { return isReadOnlyPreview() ? { global: { fetch: previewSafeFetch } } : {} }
