// @vitest-environment node
import { PGlite } from "@electric-sql/pglite"
import { readFileSync, readdirSync } from "node:fs"
import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { sqlStatements } from "./helpers/sqlStatements"

const rootFiles = readdirSync("supabase").filter(name => name.endsWith(".sql")).sort()
const migrationFiles = readdirSync("supabase/migrations").filter(name => name.endsWith(".sql")).sort()
const files = [...rootFiles.map(name => `supabase/${name}`), ...migrationFiles.map(name => `supabase/migrations/${name}`)]
const sources = files.map(path => ({ path, statements: sqlStatements(readFileSync(path, "utf8")) }))
const aclPattern = /^(?:grant|revoke)\s+[\s\S]+?\bon\s+(?:(table|sequence)\s+)?(public\.[\s\S]+?)\s+(?:to|from)\s+/i
const relationNames = (sql: string) => [...sql.matchAll(/\bpublic\.([a-z_][a-z_0-9]*)\b/gi)].map(match => match[1])
const creations = sources.flatMap(({ path, statements }) => statements.flatMap(sql => {
  const match = sql.match(/^create\s+(?:or\s+replace\s+)?(table|view)\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z_0-9]*)\b/i)
  return match ? [{ path, kind: match[1].toLowerCase(), name: match[2], sql, statements }] : []
}))
let db: PGlite

beforeAll(async () => {
  db = new PGlite()
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;")
  // Empty PostgreSQL has no Supabase auto-grants. Recreate just relation/column
  // names, then replay the real top-level ACL statements, not synthetic grants.
  // This deliberately tests permissions separately from full schema replay.
  const relations = new Map<string, Set<string>>()
  const sequences = new Set<string>()
  for (const { statements } of sources) for (const sql of statements) {
    const acl = sql.match(aclPattern)
    if (!acl) continue
    const names = relationNames(acl[2])
    if (acl[1]?.toLowerCase() === "sequence") { names.forEach(name => sequences.add(name)); continue }
    const columns = [...sql.slice(0, sql.toLowerCase().indexOf(" on ")).matchAll(/\(([^)]+)\)/g)]
      .flatMap(match => match[1].split(",").map(column => column.trim()))
    for (const name of names) {
      if (!relations.has(name)) relations.set(name, new Set(["id"]))
      columns.forEach(column => relations.get(name)!.add(column))
    }
  }
  for (const creation of creations) if (!relations.has(creation.name)) relations.set(creation.name, new Set(["id"]))
  for (const [name, columns] of relations) await db.exec(`create table public.${name} (${[...columns].map(column => `"${column}" text`).join(",")});`)
  for (const name of sequences) await db.exec(`create sequence public.${name};`)
  for (const { statements } of sources) for (const sql of statements) if (aclPattern.test(sql)) await db.exec(sql)
}, 30000)
afterAll(async () => { await db?.close() })

describe("Data API permissions without Supabase automatic grants", () => {
  it("ignores DDL-looking text inside comments, strings and dollar-quoted bodies", () => {
    expect(sqlStatements("-- grant select on public.fake to anon;\n do $x$ begin raise notice 'create table public.fake(id int);'; end $x$; /* outer /* nested */ end */ select ';';")).toHaveLength(2)
  })

  it("requires an explicit same-file service-role access decision for every new public table/view", () => {
    for (const creation of creations) {
      const grants = creation.statements.filter(sql => /^grant\s/i.test(sql) && aclPattern.test(sql) && /\bto\s+[^;]*\bservice_role\b/i.test(sql))
      expect(grants.some(sql => relationNames(sql).includes(creation.name)), `${creation.path}: ${creation.name}`).toBe(true)
    }
  })

  it("restores server SELECT access to every created relation after all later revocations", async () => {
    for (const name of new Set(creations.map(creation => creation.name))) {
      const { rows } = await db.query<{ allowed: boolean }>("select has_table_privilege('service_role',$1,'SELECT') as allowed", [`public.${name}`])
      expect(rows[0].allowed, name).toBe(true)
    }
  })

  it("enables RLS in the same source file as every created public table", () => {
    for (const creation of creations.filter(item => item.kind === "table")) {
      const enabled = new RegExp(`^alter\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${creation.name}\\s+enable\\s+row\\s+level\\s+security\\b`, "i")
      expect(creation.statements.some(sql => enabled.test(sql)), `${creation.path}: ${creation.name}`).toBe(true)
    }
  })

  it("keeps guest writes closed and internal tables inaccessible", async () => {
    for (const name of new Set(creations.map(creation => creation.name))) {
      const { rows } = await db.query<{ write: boolean }>("select has_table_privilege('anon',$1,'INSERT,UPDATE,DELETE,TRUNCATE') as write", [`public.${name}`])
      expect(rows[0].write, name).toBe(false)
    }
    for (const name of ["growth_events", "meta_ads_daily_spend", "ad_events", "search_impressions", "ai_ops_jobs", "messages", "listing_boost_orders"]) {
      expect((await db.query<{ allowed: boolean }>("select has_table_privilege('anon',$1,'SELECT') as allowed", [`public.${name}`])).rows[0].allowed, name).toBe(false)
    }
  })

  it("keeps chat, payments, reports and AI operations read-only for authenticated clients", async () => {
    for (const name of ["chats", "messages", "listing_boost_orders", "flitt_payment_attempts", "listing_reports", "notifications", "ai_ops_jobs", "ai_ops_activity", "ai_ops_approvals", "ai_ops_control"]) {
      const { rows } = await db.query<{ read: boolean; write: boolean }>("select has_table_privilege('authenticated',$1,'SELECT') as read, has_table_privilege('authenticated',$1,'INSERT,UPDATE,DELETE,TRUNCATE') as write", [`public.${name}`])
      expect(rows[0], name).toEqual({ read: true, write: false })
    }
  })

  it("grants sequence access explicitly for serial and identity columns", async () => {
    for (const creation of creations.filter(item => item.kind === "table")) {
      const columns = [...creation.sql.matchAll(/\b([a-z_][a-z_0-9]*)\s+(?:bigserial|serial|(?:bigint|integer)[^,\n]*\bas\s+identity)\b/gi)]
      for (const column of columns) {
        const sequence = `${creation.name}_${column[1]}_seq`
        expect(creation.statements.some(sql => /^grant\s/i.test(sql) && /\bon\s+sequence\b/i.test(sql) && sql.includes(`public.${sequence}`) && /\bservice_role\b/i.test(sql)), `${creation.path}: ${sequence}`).toBe(true)
        expect((await db.query<{ allowed: boolean }>("select has_sequence_privilege('service_role',$1,'USAGE') as allowed", [`public.${sequence}`])).rows[0].allowed).toBe(true)
      }
    }
  })
})
