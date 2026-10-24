import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8")
// Same version that was applied and validated on the QA project, so Production
// runs exactly the migration the QA report describes.
const migration = read("supabase/migrations/20261022085227_track_sale_source.sql")
const actions = read("app/dashboard/listings/actions.ts")
const dialog = read("components/dashboard/ListingStatusControl.tsx")

describe("Growth P0 sale-source attribution", () => {
  it("allows external sales without inventing a buyer", () => {
    expect(migration).toContain("new.sold_source = 'external'")
    expect(migration).toContain("new.sold_to_user_id is not null")
    expect(actions).toContain('soldSource === "external" && soldToUserId !== null')
  })

  it("retains the authenticated buyer requirement for SamoSell sales", () => {
    expect(migration).toContain("new.sold_source is distinct from 'samosell'")
    expect(migration).toContain("message_row.sender_id = new.sold_to_user_id")
    expect(actions).toContain('soldSource === "samosell"')
    expect(actions).toContain("validateSelectedBuyer")
  })

  it("uses one sold lifecycle and clears attribution on reopening", () => {
    expect(migration).toContain("if new.status <> 'sold' then")
    expect(migration).toContain("new.sold_source := null")
    expect(actions).toContain("sold_source: soldSource")
  })

  it("exposes the two seller choices in the existing status dialog", () => {
    expect(dialog).toContain('setSaleSource("external")')
    expect(dialog).toContain('setSaleSource("samosell")')
    expect(dialog).toContain('saleSource === "samosell" ? selectedBuyerId : undefined')
  })
})
