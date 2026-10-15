// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { abortListingUploadsAction, prepareListingUploadsAction, saveListingAction, type SaveListingInput } from "@/app/dashboard/listings/form-actions"
import { isUuid } from "@/lib/listing-form"

const mocks = vi.hoisted(() => ({ client: vi.fn(), rateLimit: vi.fn(), notify: vi.fn(), outcome: vi.fn(), revalidate: vi.fn() }))
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }))
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: mocks.rateLimit }))
vi.mock("@/lib/admin-activity-email", () => ({ notifyAdminNewListing: mocks.notify }))
vi.mock("@/lib/growth/server", () => ({ recordListingOutcome: mocks.outcome }))
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }))
vi.mock("@/lib/listings", async (original) => ({
  ...await original<typeof import("@/lib/listings")>(),
  generateUniqueListingSlug: vi.fn(async () => "test-listing"),
}))

const ownerId = "177f3329-6c04-4c40-8f33-873ab3ee4f76"
const listingId = "277f3329-6c04-4c40-8f33-873ab3ee4f76"
const foreignId = "477f3329-6c04-4c40-8f33-873ab3ee4f76"
const paths = ["377f3329-6c04-4c40-8f33-873ab3ee4f76", "577f3329-6c04-4c40-8f33-873ab3ee4f76"]
  .map((id) => `${ownerId}/${listingId}/${id}.jpg`)
const publicUrl = (path: string) => `https://storage.test/storage/v1/object/public/listing-images/${path}`
const form = {
  title: "ტყავის ქურთუკი", description: "კარგ მდგომარეობაშია და დეფექტი არ აქვს.",
  price: "120.50", categoryId: 1, brandId: "", sizeId: "", condition: "good", saleType: "sell",
  gender: "unisex", color: "", material: "", city: "თბილისი", sellerPhone: "+995 555 12 34 56", publishNow: true,
}
const input = (): SaveListingInput => ({ mode: "create", listingId, form: { ...form }, images: paths.map((path) => ({ kind: "uploaded", path })) })

let database: PGlite
let files: Map<string, Blob>
let beforeInsert: (() => Promise<void>) | null
let afterInsert: (() => Promise<void>) | null
let failImages: boolean
let failLookup: boolean
let lostInsertResponse: boolean
let lostImagesResponse: boolean
const remove = vi.fn(async (targets: string[]) => { targets.forEach((path) => files.delete(path)); return { error: null } })
const writes = vi.fn()
type Row = Record<string, unknown>

// A small transport adapter only; PostgreSQL itself enforces the real PK/FK and
// ON CONFLICT semantics. Each action gets a separate client, as on Vercel.
function queryBuilder(table: string) {
  let operation = "select"
  let payload: Row | Row[] = {}
  let ignoreDuplicates = false
  const filters: Array<[string, unknown]> = []
  async function execute(single = false) {
    if (failLookup && table === "listings" && operation === "select") return { data: null, error: new Error("lookup failed") }
    try {
      if (operation === "select") {
        const where = filters.map(([key], index) => `${key}=$${index + 1}`).join(" and ")
        const result = await database.query(`select * from ${table}${where ? ` where ${where}` : ""}${table === "listing_images" ? " order by sort_order" : ""}`, filters.map(([, value]) => value))
        return { data: single ? result.rows[0] ?? null : result.rows, error: null }
      }
      writes(table, operation)
      if (table === "listings" && operation === "insert") await beforeInsert?.()
      if (table === "listing_images" && failImages) throw new Error("image write unavailable")
      const rows = Array.isArray(payload) ? payload : [payload]
      for (const row of rows) {
        const keys = Object.keys(row)
        if (operation === "update") {
          const values = Object.values(row)
          const assignments = keys.map((key, index) => `${key}=$${index + 1}`).join(",")
          const where = filters.map(([key], index) => `${key}=$${index + values.length + 1}`).join(" and ")
          const result = await database.query(`update ${table} set ${assignments} where ${where} returning *`, [...values, ...filters.map(([, value]) => value)])
          return { data: single ? result.rows[0] ?? null : result.rows, error: null }
        }
        await database.query(`insert into ${table} (${keys.join(",")}) values (${keys.map((_, index) => `$${index + 1}`).join(",")})${ignoreDuplicates ? " on conflict (id) do nothing" : ""}`, Object.values(row))
      }
      if (table === "listings" && operation === "insert") {
        await afterInsert?.()
        if (lostInsertResponse) throw new Error("network response lost after commit")
      }
      if (table === "listing_images" && lostImagesResponse) throw new Error("image response lost after commit")
      return { data: null, error: null }
    } catch (error) { return { data: null, error } }
  }
  const builder = {
    select: () => builder,
    eq: (key: string, value: unknown) => { filters.push([key, value]); return builder },
    maybeSingle: () => execute(true),
    order: () => execute(),
    insert: (value: Row | Row[]) => { operation = "insert"; payload = value; return builder },
    upsert: (value: Row | Row[], options?: { ignoreDuplicates?: boolean }) => { operation = "upsert"; payload = value; ignoreDuplicates = Boolean(options?.ignoreDuplicates); return builder },
    update: (value: Row) => { operation = "update"; payload = value; return builder },
    then: <T, U>(resolve: (value: Awaited<ReturnType<typeof execute>>) => T, reject?: (error: unknown) => U) => execute().then(resolve, reject),
  }
  return builder
}

function createTestClient(userId: string | null = ownerId) {
  return {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null }, error: null }) },
    from: queryBuilder,
    storage: { from: () => ({
      remove,
      getPublicUrl: (path: string) => ({ data: { publicUrl: publicUrl(path) } }),
      createSignedUploadUrl: async () => ({ data: { token: "test-only" }, error: null }),
      download: async (path: string) => ({ data: files.get(path) ?? null, error: files.has(path) ? null : new Error("object missing") }),
    }) },
  }
}

function gate() {
  let open!: () => void
  const promise = new Promise<void>((resolve) => { open = resolve })
  return { promise, open }
}
async function counts() {
  const { rows } = await database.query<{ listings: number; images: number }>("select (select count(*)::int from listings) as listings, (select count(*)::int from listing_images) as images")
  return rows[0]
}

beforeAll(async () => {
  database = new PGlite()
  await database.exec(`
    create table listings (
      id uuid primary key, seller_id uuid not null, category_id integer, brand_id uuid, size_id uuid,
      title text, slug text unique, description text, price numeric, currency text, condition text,
      sale_type text, gender text, color text, material text, city text, status text,
      published_at timestamptz, cover_image_url text not null check (length(trim(cover_image_url))>0)
    );
    create table listing_images (id uuid primary key, listing_id uuid references listings(id) on delete cascade, image_url text not null, sort_order integer);
    create table profiles (id uuid primary key, store_phone text);
    create table categories (id integer primary key, is_active boolean);
    insert into categories values (1,true);
    insert into profiles(id) values ('${ownerId}');
  `)
}, 30000)
beforeEach(async () => {
  vi.clearAllMocks()
  beforeInsert = afterInsert = null
  failImages = failLookup = lostInsertResponse = lostImagesResponse = false
  files = new Map(paths.map((path) => [path, new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" })]))
  mocks.client.mockImplementation(async () => createTestClient())
  mocks.rateLimit.mockResolvedValue(undefined)
  mocks.notify.mockResolvedValue(undefined)
  mocks.outcome.mockResolvedValue(undefined)
  mocks.revalidate.mockReturnValue(undefined)
  await database.exec("truncate listing_images, listings")
})
afterAll(async () => { await database?.close() })

describe("listing publication idempotency with PostgreSQL", () => {
  it("replays a committed create without new records, rate limits, notifications or cleanup", async () => {
    const first = await saveListingAction(input())
    expect(first).toMatchObject({ ok: true, listingId, status: "active" })
    const writesBeforeReplay = writes.mock.calls.length
    expect(await saveListingAction(input())).toEqual(first)
    expect(await counts()).toEqual({ listings: 1, images: 2 })
    expect(writes).toHaveBeenCalledTimes(writesBeforeReplay)
    expect(mocks.rateLimit).toHaveBeenCalledTimes(1)
    expect(mocks.notify).toHaveBeenCalledTimes(1)
    expect(remove).not.toHaveBeenCalled()
    expect(files.size).toBe(2)
    const images = await database.query<{ id: string }>("select id from listing_images")
    expect(images.rows.every((row) => isUuid(row.id))).toBe(true)
  })

  it("does not undo later edits or restore removed images when an old create is replayed", async () => {
    expect(await saveListingAction(input())).toMatchObject({ ok: true })
    await database.query("delete from listing_images where sort_order=1")
    await database.query("update listings set title='განახლებული სათაური', status='sold' where id=$1", [listingId])
    const writesBeforeReplay = writes.mock.calls.length
    expect(await saveListingAction(input())).toMatchObject({ ok: true, status: "sold" })
    expect(await counts()).toEqual({ listings: 1, images: 1 })
    expect(writes).toHaveBeenCalledTimes(writesBeforeReplay)
  })

  it("converges simultaneous requests that both saw no parent, with real unique-key conflicts", async () => {
    const both = gate()
    let arrivals = 0
    beforeInsert = async () => { if (++arrivals === 2) both.open(); await both.promise }
    const results = await Promise.all([saveListingAction(input()), saveListingAction(input())])
    expect(arrivals).toBe(2)
    expect(results[0]).toMatchObject({ ok: true, listingId })
    expect(results[1]).toEqual(results[0])
    expect(await counts()).toEqual({ listings: 1, images: 2 })
    expect(mocks.notify).toHaveBeenCalledTimes(1)
    expect(remove).not.toHaveBeenCalled()
  })

  it("resumes images while the first process is paused after the parent commit", async () => {
    const inserted = gate()
    const resume = gate()
    afterInsert = async () => { inserted.open(); await resume.promise }
    const first = saveListingAction(input())
    await inserted.promise
    try {
      expect(await abortListingUploadsAction(listingId, paths)).toMatchObject({ protected: true })
      expect(await saveListingAction(input())).toMatchObject({ ok: true, listingId })
    } finally { resume.open() }
    expect(await first).toMatchObject({ ok: true, listingId })
    expect(await counts()).toEqual({ listings: 1, images: 2 })
    expect(remove).not.toHaveBeenCalled()
  })

  it("defers abort before an in-flight parent insert instead of deleting validated files", async () => {
    const saving = gate()
    const resume = gate()
    beforeInsert = async () => { saving.open(); await resume.promise }
    const publication = saveListingAction(input())
    await saving.promise
    try {
      expect(await abortListingUploadsAction(listingId, paths)).toMatchObject({ cleanupDeferred: true })
      expect(files.size).toBe(2)
    } finally { resume.open() }
    expect(await publication).toMatchObject({ ok: true })
    expect(await counts()).toEqual({ listings: 1, images: 2 })
    expect(remove).not.toHaveBeenCalled()
  })

  it.each(["parent", "images"])("recovers a lost %s write response after the database committed", async (stage) => {
    lostInsertResponse = stage === "parent"
    lostImagesResponse = stage === "images"
    expect(await saveListingAction(input())).toMatchObject({ ok: true, listingId })
    expect(await counts()).toEqual({ listings: 1, images: 2 })
    expect(remove).not.toHaveBeenCalled()
  })

  it("retains an interrupted create and resumes it on retry without a duplicate listing", async () => {
    failImages = true
    expect(await saveListingAction(input())).toMatchObject({ ok: false, code: "server_error" })
    expect(await counts()).toEqual({ listings: 1, images: 0 })
    expect(files.size).toBe(2)
    failImages = false
    expect(await saveListingAction(input())).toMatchObject({ ok: true, listingId })
    expect(await counts()).toEqual({ listings: 1, images: 2 })
    expect(remove).not.toHaveBeenCalled()
  })

  it("does not claim success when committed image objects are missing", async () => {
    expect(await saveListingAction(input())).toMatchObject({ ok: true })
    files.delete(paths[0])
    expect(await saveListingAction(input())).toMatchObject({ ok: false, code: "server_error" })
    await abortListingUploadsAction(listingId, paths)
    expect(await counts()).toEqual({ listings: 1, images: 2 })
    expect(files.has(paths[1])).toBe(true)
    expect(remove).not.toHaveBeenCalled()
  })

  it.each(["missing", "invalid signature", "empty"])("rejects %s uploads before inserting a listing", async (kind) => {
    if (kind === "missing") files.delete(paths[0])
    else files.set(paths[0], new Blob(kind === "empty" ? [] : ["not a JPEG"]))
    expect(await saveListingAction(input())).toMatchObject({ ok: false, code: "invalid", fieldErrors: { images: expect.any(String) } })
    expect(await counts()).toEqual({ listings: 0, images: 0 })
    expect(remove).not.toHaveBeenCalled()
  })

  it("fails closed on abort lookup failure, unowned paths and unauthenticated requests", async () => {
    failLookup = true
    expect(await abortListingUploadsAction(listingId, paths)).toMatchObject({ cleanupDeferred: true })
    expect(await abortListingUploadsAction(listingId, [`${foreignId}/${listingId}/file.jpg`])).toBeUndefined()
    mocks.client.mockImplementation(async () => createTestClient(null))
    expect(await abortListingUploadsAction(listingId, paths)).toBeUndefined()
    expect(remove).not.toHaveBeenCalled()
  })

  it("does not let another seller replay or complete a listing", async () => {
    expect(await saveListingAction(input())).toMatchObject({ ok: true })
    mocks.client.mockImplementation(async () => createTestClient(foreignId))
    expect(await saveListingAction(input())).toMatchObject({ ok: false, code: "invalid" })
    expect(await counts()).toEqual({ listings: 1, images: 2 })
    expect(remove).not.toHaveBeenCalled()
  })

  it("keeps the committed listing when a post-save operation throws", async () => {
    mocks.notify.mockRejectedValueOnce(new Error("notification transport unavailable"))
    expect(await saveListingAction(input())).toMatchObject({ ok: true, cleanupWarning: false })
    expect(await counts()).toEqual({ listings: 1, images: 2 })
    expect(files.size).toBe(2)
    expect(remove).not.toHaveBeenCalled()
  })

  it("honors the client attempt ID on repeated preparation, including a lost first response", async () => {
    const prepare = () => prepareListingUploadsAction({ mode: "create", listingId, files: [{ clientId: "image", mimeType: "image/jpeg", size: 3 }] })
    expect(await prepare()).toMatchObject({ ok: true, listingId })
    expect(await prepare()).toMatchObject({ ok: true, listingId })
    expect(await prepareListingUploadsAction({ mode: "create", listingId: "invalid", files: [{ clientId: "image", mimeType: "image/jpeg", size: 3 }] })).toMatchObject({ ok: false, code: "invalid" })
  })
})
