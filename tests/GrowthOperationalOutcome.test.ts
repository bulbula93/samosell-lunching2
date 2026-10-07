import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock("next/headers", () => ({
  cookies: mocks.cookies,
}))

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: mocks.rpc,
  }),
}))

import { recordListingOutcome } from "@/lib/growth/server"

describe("Growth operational outcomes", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.unstubAllEnvs()
    vi.stubEnv("GROWTH_TRACKING_ENABLED", "true")
    vi.stubEnv("VERCEL_ENV", "preview")
    vi.stubEnv("NEXT_PUBLIC_PREVIEW_READ_ONLY", "false")
    vi.stubEnv("PREVIEW_GROWTH_DATABASE_REF", "isolated-preview")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://isolated-preview.supabase.co")
    vi.stubEnv("META_CAPI_ENABLED", "false")
    mocks.rpc.mockResolvedValue({ data: true, error: null })
  })

  it("records listing publication even when optional analytics cookies are unavailable", async () => {
    mocks.cookies.mockRejectedValue(new Error("cookie context unavailable"))

    await recordListingOutcome(
      "listing_published",
      "dbda4aa2-0dca-4602-8269-3909a406b919",
      "5e2f78a6-bcab-461f-8cc1-930aceaac4a5",
    )

    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith(
      "record_growth_outcome",
      {
        p_event: expect.objectContaining({
          event_name: "listing_published",
          event_id: "listing_published:5e2f78a6-bcab-461f-8cc1-930aceaac4a5",
          user_id: "dbda4aa2-0dca-4602-8269-3909a406b919",
          listing_id: "5e2f78a6-bcab-461f-8cc1-930aceaac4a5",
          marketing_consent: false,
        }),
      },
    )
  })
})
