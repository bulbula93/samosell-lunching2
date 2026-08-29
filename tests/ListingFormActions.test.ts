import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  prepareListingUploadsAction,
  saveListingAction,
} from "@/app/dashboard/listings/form-actions"

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  rateLimit: vi.fn(),
  slug: vi.fn(),
  revalidatePath: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}))

vi.mock("@/lib/rate-limit", () => ({
  enforceRateLimit: mocks.rateLimit,
}))

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}))

vi.mock("@/lib/listings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/listings")>()
  return {
    ...actual,
    generateUniqueListingSlug: mocks.slug,
  }
})

const ownerId = "177f3329-6c04-4c40-8f33-873ab3ee4f76"
const listingId = "277f3329-6c04-4c40-8f33-873ab3ee4f76"

const validForm = {
  title: "ტყავის ქურთუკი",
  description: "კარგ მდგომარეობაშია და დეფექტი არ აქვს.",
  price: "120.50",
  categoryId: 1,
  brandId: "",
  sizeId: "",
  condition: "good",
  saleType: "sell",
  gender: "unisex",
  color: "შავი",
  material: "ტყავი",
  city: "თბილისი",
  sellerPhone: "+995 555 12 34 56",
  publishNow: true,
}

function profileUpdateBuilder(error: Error | null = null) {
  return {
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({
      data: error ? null : { id: ownerId },
      error,
    }),
  }
}

function storageStub() {
  return {
    from: () => ({
      remove: vi.fn().mockResolvedValue({ error: null }),
      download: vi.fn(),
      getPublicUrl: (path: string) => ({ data: { publicUrl: `https://storage.example/${path}` } }),
      createSignedUploadUrl: vi.fn(),
    }),
  }
}

describe("listing form server actions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.rateLimit.mockResolvedValue(undefined)
    mocks.slug.mockResolvedValue("tyavis-kurtuki")
  })

  it("rejects unauthenticated create and upload preparation before database access", async () => {
    const from = vi.fn()
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }) },
      from,
      storage: storageStub(),
    })

    const createResult = await saveListingAction({
      mode: "create",
      listingId,
      form: validForm,
      images: [],
    })
    const uploadResult = await prepareListingUploadsAction({ mode: "create", files: [] })

    expect(createResult).toMatchObject({ ok: false, code: "unauthorized" })
    expect(uploadResult).toMatchObject({ ok: false, code: "unauthorized" })
    expect(from).not.toHaveBeenCalled()
  })

  it("returns the same private-safe denial for a non-owner direct update", async () => {
    const update = vi.fn()
    const listingQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
      update,
    }
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: ownerId } }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "listings") return listingQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      storage: storageStub(),
    })

    const result = await saveListingAction({
      mode: "edit",
      listingId,
      form: validForm,
      images: [],
    })

    expect(result).toMatchObject({ ok: false, code: "not_found" })
    expect(update).not.toHaveBeenCalled()
  })

  it("derives seller and status server-side and ignores injected internal fields", async () => {
    let insertedPayload: Record<string, unknown> | null = null
    const listings = {
      insert: vi.fn((payload: Record<string, unknown>) => {
        insertedPayload = payload
        return Promise.resolve({ error: null })
      }),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    const categoryQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
    }
    const profileQuery = profileUpdateBuilder()

    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: ownerId } }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "listings") return listings
        if (table === "categories") return categoryQuery
        if (table === "profiles") return profileQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      storage: storageStub(),
    })

    const maliciousForm = {
      ...validForm,
      seller_id: "attacker",
      owner_id: "attacker",
      status: "sold",
      views_count: 999_999,
      is_vip: true,
    } as typeof validForm

    const result = await saveListingAction({
      mode: "create",
      listingId,
      form: maliciousForm,
      images: [],
    })

    expect(result).toMatchObject({ ok: true, status: "active", slug: "tyavis-kurtuki" })
    expect(insertedPayload).toMatchObject({
      id: listingId,
      seller_id: ownerId,
      status: "active",
      price: "120.50",
      currency: "GEL",
    })
    expect(insertedPayload).not.toHaveProperty("owner_id")
    expect(insertedPayload).not.toHaveProperty("views_count")
    expect(insertedPayload).not.toHaveProperty("is_vip")
    expect(profileQuery.update).toHaveBeenCalledWith({ store_phone: "+995 555 12 34 56" })
    expect(mocks.rateLimit).toHaveBeenCalledWith(expect.anything(), "listing_create")
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/catalog")
  })

  it("updates only an owned listing and preserves a protected sold status", async () => {
    const ownedListing = {
      id: listingId,
      seller_id: ownerId,
      category_id: 1,
      brand_id: null,
      size_id: null,
      title: "ძველი სათაური",
      slug: "dzveli-satauri",
      description: "ძველი აღწერა საკმარისი სიგრძით.",
      price: "50.00",
      condition: "good",
      sale_type: "sell",
      gender: "unisex",
      color: null,
      material: null,
      city: null,
      status: "sold",
      published_at: "2026-08-01T00:00:00.000Z",
      cover_image_url: null,
    }
    let updatedPayload: Record<string, unknown> | null = null
    let listingSelectCalls = 0
    const listingBuilder = {
      operation: "select",
      select: vi.fn(function (this: { operation: string }) {
        return this
      }),
      eq: vi.fn().mockReturnThis(),
      update: vi.fn(function (this: { operation: string }, payload: Record<string, unknown>) {
        this.operation = "update"
        updatedPayload = payload
        return this
      }),
      maybeSingle: vi.fn(function (this: { operation: string }) {
        if (this.operation === "update") return Promise.resolve({ data: { id: listingId }, error: null })
        listingSelectCalls += 1
        return Promise.resolve({ data: ownedListing, error: null })
      }),
    }
    const categoryBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
    }
    const imagesBuilder = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({ data: [], error: null }),
    }
    const profileQuery = profileUpdateBuilder()

    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: ownerId } }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "listings") return listingBuilder
        if (table === "categories") return categoryBuilder
        if (table === "listing_images") return imagesBuilder
        if (table === "profiles") return profileQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      storage: storageStub(),
    })

    const result = await saveListingAction({
      mode: "edit",
      listingId,
      form: { ...validForm, title: "განახლებული სათაური", publishNow: false },
      images: [],
    })

    expect(listingSelectCalls).toBe(1)
    expect(result).toMatchObject({ ok: true, status: "sold" })
    expect(updatedPayload).toMatchObject({
      title: "განახლებული სათაური",
      status: "sold",
      published_at: ownedListing.published_at,
    })
    expect(updatedPayload).not.toHaveProperty("seller_id")
  })

  it("returns controlled validation errors before performing a mutation", async () => {
    const from = vi.fn()
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: ownerId } }, error: null }) },
      from,
      storage: storageStub(),
    })

    const result = await saveListingAction({
      mode: "create",
      listingId,
      form: { ...validForm, title: " ", price: "-5", condition: "sold" },
      images: [],
    })

    expect(result).toMatchObject({
      ok: false,
      code: "invalid",
      fieldErrors: expect.objectContaining({
        title: expect.any(String),
        price: expect.any(String),
        condition: expect.any(String),
      }),
    })
    expect(from).not.toHaveBeenCalled()
  })

  it("rejects a missing seller phone before database access", async () => {
    const from = vi.fn()
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: ownerId } }, error: null }) },
      from,
      storage: storageStub(),
    })

    const result = await saveListingAction({
      mode: "create",
      listingId,
      form: { ...validForm, sellerPhone: "" },
      images: [],
    })

    expect(result).toMatchObject({
      ok: false,
      code: "invalid",
      fieldErrors: expect.objectContaining({ sellerPhone: expect.any(String) }),
    })
    expect(from).not.toHaveBeenCalled()
  })

  it("creates server-owned signed upload paths and rejects MIME spoof metadata", async () => {
    const createSignedUploadUrl = vi.fn().mockResolvedValue({
      data: { token: "signed-token" },
      error: null,
    })
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: ownerId } }, error: null }) },
      from: vi.fn(),
      storage: {
        from: () => ({
          createSignedUploadUrl,
          remove: vi.fn().mockResolvedValue({ error: null }),
        }),
      },
    })

    const result = await prepareListingUploadsAction({
      mode: "create",
      files: [{ clientId: "preview-1", mimeType: "image/webp", size: 1_024 }],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.plans[0].path).toMatch(
        new RegExp(`^${ownerId}/${result.listingId}/[0-9a-f-]{36}\\.webp$`, "i")
      )
      expect(createSignedUploadUrl).toHaveBeenCalledWith(result.plans[0].path)
    }

    const invalid = await prepareListingUploadsAction({
      mode: "create",
      files: [{ clientId: "preview-2", mimeType: "image/svg+xml", size: 1_024 }],
    })
    expect(invalid).toMatchObject({ ok: false, code: "invalid" })
    expect(createSignedUploadUrl).toHaveBeenCalledOnce()
  })

  it("returns a controlled error when the database insert fails", async () => {
    const categoryQuery = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: { id: 1 }, error: null }),
    }
    const listings = {
      insert: vi.fn().mockResolvedValue({
        error: new Error("postgres internal detail should stay private"),
      }),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    }
    const profileQuery = profileUpdateBuilder()
    mocks.createClient.mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: ownerId } }, error: null }) },
      from: vi.fn((table: string) => {
        if (table === "categories") return categoryQuery
        if (table === "listings") return listings
        if (table === "profiles") return profileQuery
        throw new Error(`Unexpected table ${table}`)
      }),
      storage: storageStub(),
    })

    const result = await saveListingAction({
      mode: "create",
      listingId,
      form: validForm,
      images: [],
    })

    expect(result).toMatchObject({ ok: false, code: "server_error" })
    if (!result.ok) expect(result.message).not.toContain("postgres")
    expect(mocks.revalidatePath).not.toHaveBeenCalled()
  })
})
