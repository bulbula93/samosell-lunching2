// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const SQL = readFileSync("supabase/migrations/20261107020000_indexnow_ping.sql", "utf8")

describe("IndexNow setup", () => {
  it("serves exactly one key file whose content matches the key and keyLocation in the ping function", () => {
    const keyFiles = readdirSync("public").filter(f => /^[a-f0-9]{32}\.txt$/.test(f))
    expect(keyFiles).toHaveLength(1)
    const key = keyFiles[0].replace(".txt", "")
    expect(readFileSync(`public/${keyFiles[0]}`, "utf8")).toBe(key)
    expect(SQL).toContain(`'key', '${key}'`)
    expect(SQL).toContain(`'keyLocation', 'https://samosell.ge/${key}.txt'`)
  })

  it("only pings ever-public listing URLs on the canonical host and stays private to the database", () => {
    expect(SQL).toContain("'host', 'samosell.ge'")
    expect(SQL).toContain("'https://samosell.ge/listing/' || slug")
    expect(SQL).toMatch(/l\.status = 'active' or l\.published_at is not null/)
    expect(SQL).toMatch(/security definer\s+set search_path = ''/)
    expect(SQL).toContain("revoke all on function private.indexnow_ping() from public, anon, authenticated")
    expect(SQL).toContain("'*/30 * * * *'")
  })
})
