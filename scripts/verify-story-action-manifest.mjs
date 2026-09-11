import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"

// Run after a build, or after requesting / on a dev server:
// node scripts/verify-story-action-manifest.mjs [--dev] [http://localhost:3104]
const root = process.argv.includes("--dev") ? ".next/dev" : ".next"
const origin = process.argv.slice(2).find((arg) => arg.startsWith("http"))
if (origin) {
  const url = new URL(origin)
  assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "Only local action probes are allowed")
}
const manifest = JSON.parse(readFileSync(join(root, "server/server-reference-manifest.json"), "utf8"))
function chunks(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => entry.isDirectory()
    ? chunks(join(directory, entry.name))
    : entry.name.endsWith(".js") ? [readFileSync(join(directory, entry.name), "utf8")] : [])
}
const clientChunks = chunks(join(root, "static/chunks"))
// The Supabase SDK's dev comments mention secret env names in examples; check
// our privileged modules and an actual private build sentinel instead.
for (const forbidden of ["story-media-validation", "createAdminClient", "cleanup_project_mismatch", "prune_unpublished_story_upload_plans"]) {
  assert(!clientChunks.some((chunk) => chunk.includes(forbidden)), `Server-only code leaked to browser: ${forbidden}`)
}
if (process.env.STORY_BUNDLE_SECRET_SENTINEL) {
  assert(!clientChunks.some((chunk) => chunk.includes(process.env.STORY_BUNDLE_SECRET_SENTINEL)), "Private build sentinel leaked")
}
const actions = {
  prepareStoryUploadAction: [{ mimeType: "image/webp", size: 4 }],
  publishStoryAction: [{ storyId: "invalid", path: "invalid", mediaType: "image" }],
  abortStoryUploadAction: ["invalid", "invalid"],
}
for (const [name, args] of Object.entries(actions)) {
  const entries = Object.entries(manifest.node).filter(([, action]) => action.exportedName === name)
  assert.equal(entries.length, 1, `${name} must have one registered identity`)
  const [id, action] = entries[0]
  assert(action.workers["app/page"], `${name} is missing from the homepage worker`)
  assert(clientChunks.some((chunk) => chunk.includes(id)), `${name} client reference does not match the manifest`)
  console.log(`${name}: ${id} registered on app/page; present in client chunks`)
  if (origin) {
    // No cookies or credentials. This proves dispatch reaches the auth guard,
    // without creating a plan, uploading media, or publishing a Story.
    const response = await fetch(new URL("/", origin), {
      method: "POST",
      headers: { "Next-Action": id, "Content-Type": "text/plain;charset=UTF-8", Accept: "text/x-component", Origin: new URL(origin).origin },
      body: JSON.stringify(args),
    })
    const body = await response.text()
    assert.equal(response.status, 200, `${name}: unexpected HTTP ${response.status}`)
    assert(response.headers.get("content-type")?.includes("text/x-component"), `${name}: not an action response`)
    assert(!body.includes("Failed to find Server Action"), `${name}: dispatch failed`)
    assert(name === "abortStoryUploadAction" ? /^\d+:"\$undefined"$/m.test(body) : body.includes('"ok":false'), `${name}: expected unauthenticated rejection`)
    console.log(`${name}: real local POST reached auth rejection`)
  }
}
