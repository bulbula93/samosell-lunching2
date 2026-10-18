// Deterministic local production-server comparison. No real database or writes.
// node scripts/benchmark-public-cache.mjs --baseline /tmp/samosell-cache-baseline --output docs/performance/public-cache-benchmark.json
import { createPublicCacheFixture } from "./public-cache-fixture.mjs"
import { spawn } from "node:child_process"
import { writeFile, mkdir, symlink, access, rm } from "node:fs/promises"
import { resolve, dirname, join } from "node:path"
import { once } from "node:events"

const args = process.argv.slice(2)
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback
const candidate = process.cwd()
const baseline = resolve(option("--baseline", "/tmp/samosell-cache-baseline"))
const output = resolve(option("--output", "docs/performance/public-cache-benchmark.json"))
const iterations = Number(option("--iterations", "30"))
let upstream = 0
const fixture = createPublicCacheFixture(() => { upstream++ })
fixture.listen(3199, "127.0.0.1")
await once(fixture, "listening")
const fixturePort = fixture.address().port
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}`,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "benchmark-anonymous-public-key", NEXT_PUBLIC_SITE_URL: "http://localhost:3201",
  NODE_ENV: "production", VERCEL_ENV: "", NEXT_PUBLIC_PREVIEW_READ_ONLY: "false", NEXT_TELEMETRY_DISABLED: "1", STORIES_UI_DISABLED: "true" }
const nextBin = join(candidate, "node_modules/next/dist/bin/next")
async function runBuild(root, label) {
  try { await access(join(root, "node_modules")) } catch { await symlink(join(candidate, "node_modules"), join(root, "node_modules"), "dir") }
  await rm(join(root, ".next"), { recursive: true, force: true })
  const child = spawn(process.execPath, [nextBin, "build", "--webpack"], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] })
  let log = ""
  child.stdout.on("data", (data) => { log += data })
  child.stderr.on("data", (data) => { log += data })
  const [code] = await once(child, "exit")
  await writeFile(`/tmp/public-cache-${label}-build.log`, log)
  if (code !== 0) throw new Error(`${label} build failed: /tmp/public-cache-${label}-build.log`)
  console.log(`${label}: production build passed`)
}
const pause = (ms) => new Promise((done) => setTimeout(done, ms))
const preload = "/tmp/public-cache-cpu-preload.cjs"
await writeFile(preload, `process.on('message', message => {
  if (message?.type === 'benchmarkCpu') process.send({type:'benchmarkCpu', usage:process.cpuUsage()})
})\n`)
async function cpuMs(child) {
  const answer = once(child, "message")
  child.send({ type: "benchmarkCpu" })
  const [message] = await answer
  return (message.usage.user + message.usage.system) / 1000
}
const paths = ["/", "/api/home-personalization", "/listing/benchmark-listing", "/seller/benchmark_seller"]
async function measure(root, label) {
  const port = label === "baseline" ? 3201 : 3202
  const child = spawn(process.execPath, ["--require", preload, nextBin, "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: root, env, stdio: ["ignore", "pipe", "pipe", "ipc"] })
  let log = ""
  child.stdout.on("data", (data) => { log += data })
  child.stderr.on("data", (data) => { log += data })
  const request = async (path) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { redirect: "manual" })
    const body = await response.text()
    if (response.status !== 200 || (path.startsWith("/listing/") && !body.includes("Public listing 0"))) {
      throw new Error(`${label} ${path}: unexpected response ${response.status}`)
    }
    return response
  }
  try {
    for (let attempt = 0; ; attempt++) {
      try { await request("/"); break } catch (error) { if (attempt >= 60) throw error; await pause(250) }
    }
    // Identical warm-up for both variants, excluded from the measured sample.
    for (let pass = 0; pass < 3; pass++) for (const path of paths) await request(path)
    await pause(500)
    const rows = []
    for (const path of paths) {
      const cpuBefore = await cpuMs(child)
      const upstreamBefore = upstream
      let hits = 0
      const cacheHeaders = new Set()
      for (let i = 0; i < iterations; i++) {
        const response = await request(path)
        const cache = response.headers.get("x-nextjs-cache") ?? "DYNAMIC"
        cacheHeaders.add(cache)
        if (cache === "HIT") hits++
      }
      rows.push({ path, requests: iterations, processCpuMs: Number((await cpuMs(child) - cpuBefore).toFixed(3)),
        upstreamRequests: upstream - upstreamBefore, routeCacheHits: hits, routeCacheHitRatio: hits / iterations,
        cacheHeaders: [...cacheHeaders] })
    }
    return rows
  } finally {
    child.kill("SIGTERM")
    await once(child, "exit")
    await writeFile(`/tmp/public-cache-${label}-server.log`, log)
  }
}
try {
  if (!args.includes("--skip-build")) {
    if (!args.includes("--skip-baseline-build")) await runBuild(baseline, "baseline")
    await runBuild(candidate, "candidate")
  }
  const report = { measuredAt: new Date().toISOString(), node: process.version, iterations,
    scope: "Local Next production servers, deterministic anonymous fixture, sequential warm requests. Node process.cpuUsage via IPC; not Vercel Active CPU or live CDN. HTTP client and fixture CPU excluded. Warm-up/build excluded. No browser JS, images or real user sessions.",
    baseline: await measure(baseline, "baseline"), candidate: await measure(candidate, "candidate") }
  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, JSON.stringify(report, null, 2) + "\n")
  console.log(JSON.stringify(report, null, 2))
} finally { fixture.close() }
