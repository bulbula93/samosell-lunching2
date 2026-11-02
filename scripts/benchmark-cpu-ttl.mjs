import {createPublicCacheFixture} from "./public-cache-fixture.mjs";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {writeFile, readFile, symlink} from "node:fs/promises";
import {resolve} from "node:path";
const base=resolve(process.env.CPU_BENCH_WORK_DIR ?? ".."), modules=resolve("node_modules");
const next=resolve(modules,"next/dist/bin/next");
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const preload=resolve(base,"cpu-preload.cjs");
await writeFile(preload,`process.on('message', m=>{if(m?.type==='cpu')process.send(process.cpuUsage())})`);
const results=[];
for (const [name,ttl] of [["baseline",60],["ttl-candidate",300]]) {
 const root=resolve(base,name); try {await symlink(modules,resolve(root,"node_modules"),"junction")}catch(e){if(e.code!=="EEXIST")throw e}
 let count=0;const fixture=createPublicCacheFixture(()=>count++);fixture.listen(0,"127.0.0.1");await once(fixture,"listening");
 const env={...process.env,NEXT_PUBLIC_SUPABASE_URL:`http://127.0.0.1:${fixture.address().port}`,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"fixture-only",NEXT_PUBLIC_SITE_URL:"http://localhost:3220",NEXT_PUBLIC_PREVIEW_READ_ONLY:"false",NEXT_TELEMETRY_DISABLED:"1",VERCEL_ENV:"development",STORIES_UI_DISABLED:"true"};
 let log="";const build=spawn(process.execPath,[next,"build","--webpack"],{cwd:root,env,stdio:["ignore","pipe","pipe"]});build.stdout.on("data",d=>log+=d);build.stderr.on("data",d=>log+=d);const [code]=await once(build,"exit");await writeFile(resolve(base,`${name}-build.log`),log);if(code)throw Error(`${name} build ${code}`);
 const manifest=JSON.parse(await readFile(resolve(root,".next/prerender-manifest.json"),"utf8"));
 const port=name==="baseline"?3220:3221; const child=spawn(process.execPath,["--require",preload,next,"start","--hostname","127.0.0.1","--port",String(port)],{cwd:root,env,stdio:["ignore","pipe","pipe","ipc"]});let serverLog="";child.stdout.on("data",d=>serverLog+=d);child.stderr.on("data",d=>serverLog+=d);
 const request=async()=>{const r=await fetch(`http://127.0.0.1:${port}/`);const html=await r.text();if(r.status!==200||!html.includes("Public listing 0"))throw Error(`HTTP ${r.status}`);return r.headers.get("x-nextjs-cache")};
 for(let i=0;;i++){try{await request();break}catch(e){if(i>120)throw e;await pause(250)}}
 await pause(500);const cpu=async()=>{const p=once(child,"message");child.send({type:"cpu"});const [u]=await p;return (u.user+u.system)/1000};
 results.push({name,ttl,root,child,fixture,request,cpu,upstream:()=>count,rows:[],manifestTTL:manifest.routes["/"].initialRevalidateSeconds,log:()=>serverLog});
 console.log(`${name} build READY; effective route TTL ${manifest.routes["/"].initialRevalidateSeconds}`);
}
try {
 const start=Date.now();
 for(const second of [0,65,130,195,260,325]) {
  await pause(Math.max(0,start+second*1000-Date.now()));
  for(const r of results){const before=r.upstream(),cpuBefore=await r.cpu();const cache=await r.request();await pause(350);const hit=await r.request();r.rows.push({elapsedSeconds:second,requests:2,cache,followupCache:hit,upstreamRequests:r.upstream()-before,processCpuMs: +(await r.cpu()-cpuBefore).toFixed(3)});}
  console.log(`sample ${second}s complete`);
 }
 const report={method:"Local Next 16.2.3 production servers; identical 20-row deterministic fixture; real elapsed time, no virtual clocks; process.cpuUsage via IPC includes server/background activity during each sample and excludes HTTP client/fixture. Not Vercel billed Active CPU. Two HTML requests per interval, no browser JS/images. CPU samples may include JIT/GC; no statistics or live origin invocation measurements.",measuredAt:new Date().toISOString(),results:results.map(({name,ttl,manifestTTL,rows})=>({name,ttl,manifestTTL,rows}))};
 await writeFile(resolve(base,"ttl-results.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{for(const r of results){r.child.kill();r.fixture.close();await writeFile(resolve(base,`${r.name}-server.log`),r.log())}}
