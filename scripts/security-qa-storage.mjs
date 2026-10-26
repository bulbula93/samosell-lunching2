// Explicit QA-only REST/Storage integration checks. Credentials stay outside git.
import { readFile } from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"
import assert from "node:assert/strict"

const url = "https://ydocqjdjmffysexkzxyc.supabase.co"
const key = "sb_publishable_GimAu7-NHZn6fbQdl0rTmA_vaDHd4MM"
const credentials = JSON.parse(await readFile(process.env.SECURITY_QA_CREDENTIALS, "utf8"))
const before = process.argv.includes("--before")
const results = []
const clients = []
const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jD1sAAAAASUVORK5CYII=", "base64")
for (const credential of credentials) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  const { data, error } = await client.auth.signInWithPassword(credential)
  assert(!error && data.user?.id === credential.id, "Disposable QA sign-in failed")
  clients.push(client)
}
const [a,b] = clients
const anon = createClient(url, key, { auth: { persistSession: false } })
const prefix = credentials[0].id + "/security-audit-20261026/"
for (const bucket of ["avatars", "store-branding"]) {
  const owner = a.storage.from(bucket)
  const other = b.storage.from(bucket)
  const path = prefix + "owner.png"
  const foreign = prefix + "foreign.png"
  const upsert = prefix + "upsert.png"
  try {
    assert(!(await owner.upload(path, bytes, { contentType: "image/png", upsert: true })).error)
    if (!before) {
      const move = await owner.move(path, credentials[1].id + "/security-audit-20261026/moved.png")
      assert(move.error, "UPDATE WITH CHECK must reject a move into another namespace")
    }
    results.push(bucket + ": own upload PASS")
    const insert = await other.upload(foreign, bytes, { contentType: "image/png" })
    assert(before ? !insert.error : !!insert.error, "Cross-user INSERT boundary")
    const update = await other.update(path, bytes, { contentType: "image/png" })
    assert(before ? !update.error : !!update.error, "Cross-user UPDATE boundary")
    const overwrite = await other.upload(path, bytes, { contentType: "image/png", upsert: true })
    assert(before ? !overwrite.error : !!overwrite.error, "Cross-user upsert overwrite boundary")
    const create = await other.upload(upsert, bytes, { contentType: "image/png", upsert: true })
    assert(before ? !create.error : !!create.error, "Cross-user upsert insert boundary")
    const remove = await other.remove([path])
    assert(!remove.error && (before ? remove.data.length === 1 : remove.data.length === 0), "Cross-user DELETE boundary")
    results.push(bucket + ": cross-user INSERT/UPDATE/upsert/DELETE " + (before ? "REPRODUCED" : "DENIED"))
    if (before) assert(!(await owner.upload(path, bytes, { contentType: "image/png" })).error)
    assert(!(await owner.update(path, bytes, { contentType: "image/png" })).error)
    assert(!(await owner.upload(path, bytes, { contentType: "image/png", upsert: true })).error)
    const publicUrl = owner.getPublicUrl(path).data.publicUrl
    const image = await fetch(publicUrl)
    assert(image.ok && (await image.arrayBuffer()).byteLength === bytes.length, "Public delivery")
    assert((await anon.storage.from(bucket).upload(prefix + "anon.png", bytes, { contentType: "image/png" })).error)
    results.push(bucket + ": own replacement/upsert and public delivery PASS; anonymous INSERT DENIED")
  } finally {
    const removed = await owner.remove([path, foreign, upsert])
    assert(!removed.error, "Fixture cleanup failed")
    assert(!(await owner.list(prefix)).data?.length, "Fixture objects remain")
  }
}
for (const client of clients) await client.auth.signOut({ scope: "local" })
console.log(JSON.stringify({ target: url, phase: before ? "before" : "after", results }, null, 2))
