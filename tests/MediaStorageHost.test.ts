import { afterEach, describe, expect, it, vi } from "vitest"
import { getPublicStorageHosts, getSafeImageSource, PUBLIC_STORAGE_HOST } from "@/lib/media"

const qaHost = "ydocqjdjmffysexkzxyc.supabase.co"
const path = "/storage/v1/object/public/listing-images/qa/item.png"
afterEach(() => vi.unstubAllEnvs())

describe("configured storage project images", () => {
  it("renders uploads from the configured QA project", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${qaHost}`)
    expect(getSafeImageSource(`https://${qaHost}${path}`)).toBe(`https://${qaHost}${path}`)
    expect(getPublicStorageHosts()).toEqual([PUBLIC_STORAGE_HOST, qaHost])
  })
  it("does not trust a different Supabase project", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${PUBLIC_STORAGE_HOST}`)
    expect(getSafeImageSource(`https://${qaHost}${path}`)).toBeNull()
  })
  it.each(["http://localhost:3000", "https://example.com", "https://127.0.0.1", `https://${qaHost}:444`, `https://secret@${qaHost}`])("does not widen the allowlist for unsafe configuration %s", (url) => {
    expect(getPublicStorageHosts(url)).toEqual([PUBLIC_STORAGE_HOST])
  })
  it("rejects private storage, credentials, insecure schemes and unknown hosts", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `https://${qaHost}`)
    for (const url of [`https://${qaHost}/storage/v1/object/sign/listing-images/private.png`, `https://user@${qaHost}${path}`, `http://${qaHost}${path}`, `https://example.com${path}`]) {
      expect(getSafeImageSource(url)).toBeNull()
    }
    expect(getSafeImageSource(`/brand/test.png`)).toBe("/brand/test.png")
  })
})
