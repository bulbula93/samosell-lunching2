import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const repoRoot=process.env.QA_REPO_ROOT??process.cwd();
const resultPath=process.env.QA_OUTPUT_FILE??path.join(os.tmpdir(),'samosell-home-cache-results.json');
const home=process.env.QA_HOME_ORIGIN??'http://127.0.0.1:4200',fixture=process.env.QA_FIXTURE_ORIGIN??'http://127.0.0.1:4201';
for(const origin of [home,fixture])if(new URL(origin).hostname!=='127.0.0.1')throw Error('QA requires isolated loopback services');
const source=fs.readFileSync(path.join(repoRoot,'lib/i18n/ka.ts'),'utf8');
const emptyTitle=source.match(/emptyTitle:\s*"([^"]+)"/)?.[1];if(!emptyTitle)throw Error('Empty-state marker missing');
const results=[];const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const control=async mode=>(await fetch(fixture+'/qa-control'+(mode?'?mode='+mode:''))).json();
async function capture(name){const start=Date.now();const response=await fetch(home+'/');const html=await response.text();const state=await control();return {name,status:response.status,elapsedMs:Date.now()-start,notice:html.includes('განცხადებების ნაწილი დროებით ვერ ჩაიტვირთა'),emptyMarketplace:html.includes(emptyTitle),visibleFixture:/>QA CACHE FIXTURE</.test(html),zeroActive:html.includes('0 აქტიური განცხადება SAMOSELL-ზე'),catalogCalls:state.catalogCalls};}
function check(result,condition){results.push({...result,pass:condition});fs.writeFileSync(resultPath,JSON.stringify(results,null,2));if(!condition)throw Error('QA assertion failed: '+result.name);}
await control('fail_all');const cold=await capture('cold-cache-two-api-failures');check(cold,cold.status===200&&cold.notice&&!cold.emptyMarketplace&&!cold.zeroActive&&!cold.visibleFixture&&cold.catalogCalls===2);
await control('fail_once');const retry=await capture('fresh-client-retry-recovers-real-content');check(retry,retry.status===200&&!retry.notice&&!retry.emptyMarketplace&&retry.visibleFixture&&retry.catalogCalls===2);
await control('fail_all');const cached=await capture('cached-success-survives-api-outage');check(cached,cached.status===200&&cached.visibleFixture&&!cached.notice&&!cached.emptyMarketplace&&cached.catalogCalls===0);
await sleep(65000);const stale=await capture('expired-cache-serves-stale-success');await sleep(1500);const state=await control();stale.callsAfterBackground=state.catalogCalls;check(stale,stale.status===200&&stale.visibleFixture&&!stale.notice&&!stale.emptyMarketplace&&state.catalogCalls===2);
const retained=await capture('failed-revalidation-keeps-cached-success');check(retained,retained.status===200&&retained.visibleFixture&&!retained.notice&&!retained.emptyMarketplace);
console.log(JSON.stringify({checks:results.length,allPassed:results.every(x=>x.pass)}));
