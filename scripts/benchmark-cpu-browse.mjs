// Matched local production servers only. Build both trees with public fixtures first.
import { createPublicCacheFixture } from "./public-cache-fixture.mjs"
import { spawn } from "node:child_process"
import { once } from "node:events"
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises"
import { resolve, dirname } from "node:path"
const args = process.argv.slice(2)
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name)+1] : fallback
const baseline = resolve(option("--baseline", "../baseline"))
const candidate = process.cwd()
const output = resolve(option("--output", "../browse-results.json"))
const preload = resolve(dirname(output), "browse-cpu-preload.cjs")
await mkdir(dirname(output), { recursive: true })
await writeFile(preload, "process.on('message',m=>{if(m?.type==='cpu')process.send(process.cpuUsage())})")
const pause = ms => new Promise(r => setTimeout(r, ms))
const reports = []
for (const [index, root] of [baseline, candidate].entries()) {
  let fixturePort = 0
  for (const file of await readdir(resolve(root, ".next/server"), { recursive: true })) {
    if (!file.endsWith(".js")) continue
    const compiled = await readFile(resolve(root, ".next/server", file), "utf8")
    fixturePort = Number(compiled.match(/http:\/\/127\.0\.0\.1:(\d+)/)?.[1])
    if (fixturePort) break
  }
  if (!fixturePort) throw new Error("Expected a local-fixture build; refusing external database")
  const calls = []
  const fixture = createPublicCacheFixture(req => calls.push(new URL(req.url, "http://fixture").pathname))
  fixture.listen(fixturePort, "127.0.0.1"); await once(fixture, "listening")
  const port = 3230 + index
  const child = spawn(process.execPath, ["--require", preload, resolve("node_modules/next/dist/bin/next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], { cwd: root, env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${fixturePort}`, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-only", VERCEL_ENV: "development", NEXT_PUBLIC_PREVIEW_READ_ONLY: "false", NEXT_TELEMETRY_DISABLED: "1" }, stdio: ["ignore", "pipe", "pipe", "ipc"] })
  let log=""; child.stdout.on("data", d=>log+=d); child.stderr.on("data", d=>log+=d)
  const cpu = async () => { const p=once(child,"message"); child.send({type:"cpu"}); const [u]=await p; return (u.user+u.system)/1000 }
  const request = async path => { const r = await fetch(`http://127.0.0.1:${port}${path}`); const html = await r.text(); if (r.status!==200 || !html.includes("Public listing 0")) throw new Error(`${path}: ${r.status}`); return {status:r.status,cache:r.headers.get("x-nextjs-cache")??"DYNAMIC",canonical:html.match(/rel="canonical" href="([^"]+)"/)?.[1]} }
  try {
    for(let i=0;;i++){try{await fetch(`http://127.0.0.1:${port}/robots.txt`);break}catch(e){if(i>100)throw e;await pause(200)}}
    const rows=[]
    for (const path of ["/catalog", "/catalog/women"]) {
      const coldStart=calls.length, coldCpu=await cpu(); const cold=await request(path)
      rows.push({path,scenario:"first-request",requests:1,upstreamRequests:calls.length-coldStart,processCpuMs:+(await cpu()-coldCpu).toFixed(3),...cold})
      await request(path); await pause(200)
      const before=calls.length,cpuBefore=await cpu();const statuses=[]
      for(let i=0;i<10;i++) statuses.push(await request(path))
      rows.push({path,scenario:"warm",requests:10,localOriginHttpRequests:10,upstreamRequests:calls.length-before,upstreamByPath:Object.fromEntries([...new Set(calls.slice(before))].map(p=>[p,calls.slice(before).filter(v=>v===p).length])),processCpuMs:+(await cpu()-cpuBefore).toFixed(3),statuses})
    }
    reports.push({variant:index===0?"baseline-main":"candidate",rows})
  } finally { child.kill(); await once(child,"exit"); fixture.close(); await writeFile(resolve(dirname(output),`browse-${index}-server.log`),log) }
}
const report={measuredAt:new Date().toISOString(),node:process.version,method:"Local next start; same 20-row read-only fixture; process.cpuUsage via IPC, excludes fixture/client processes. First request includes JIT/startup and shared cache warm-up; warm sample 10 sequential HTML requests per path. No browser hydration/images, live users, Vercel invocations or billed Active CPU measured. Dynamic catalog origin HTTP requests remain unchanged.",reports}
await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2))
