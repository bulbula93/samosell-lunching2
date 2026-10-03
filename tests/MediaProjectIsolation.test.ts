import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("configured project media isolation", () => {
  async function media() {
    vi.resetModules()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ydocqjdjmffysexkzxyc.supabase.co")
    return import("@/lib/media")
  }

  it("renders public image URLs from the configured QA project", async () => {
    const { getSafeImageSource } = await media()
    const source = "https://ydocqjdjmffysexkzxyc.supabase.co/storage/v1/object/public/listing-images/qa.png"
    expect(getSafeImageSource(source)).toBe(source)
    expect(getSafeImageSource("/images/fallback.png")).toBe("/images/fallback.png")
  })

  it("rejects images from Production and unrelated projects in QA", async () => {
    const { getSafeImageSource } = await media()
    expect(getSafeImageSource("https://lxsvjzbiuewgwpajqrwr.supabase.co/storage/v1/object/public/listing-images/prod.png")).toBeNull()
    expect(getSafeImageSource("https://other.supabase.co/storage/v1/object/public/listing-images/other.png")).toBeNull()
  })

  it("rejects private paths, credentials, and unconfigured ports", async () => {
    const { getSafeImageSource } = await media()
    expect(getSafeImageSource("https://ydocqjdjmffysexkzxyc.supabase.co/storage/v1/object/sign/chat-images/private.png")).toBeNull()
    expect(getSafeImageSource("https://user:secret@ydocqjdjmffysexkzxyc.supabase.co/storage/v1/object/public/listing-images/qa.png")).toBeNull()
    expect(getSafeImageSource("https://ydocqjdjmffysexkzxyc.supabase.co:444/storage/v1/object/public/listing-images/qa.png")).toBeNull()
  })
})
