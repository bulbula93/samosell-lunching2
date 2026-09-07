// In-memory PostgreSQL regression harness. Never connects to Supabase/TBC.
// TBC_TEST_PGLITE_PATH points to a temporary installation of @electric-sql/pglite.
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { randomUUID } from "node:crypto"

if (!process.env.TBC_TEST_PGLITE_PATH) throw new Error("Set TBC_TEST_PGLITE_PATH to the local PGlite module")
const { PGlite } = await import(pathToFileURL(process.env.TBC_TEST_PGLITE_PATH).href)
const db = new PGlite()
let checks = 0
function check(condition, message) { assert.ok(condition, message); checks += 1; console.log("PASS", message) }
const read = (name) => readFileSync(name, "utf8")
const extractFunction = (file, name) => {
  const sql = read(file)
  const start = sql.indexOf("create or replace function " + name + "(")
  assert.ok(start >= 0)
  return sql.slice(start, sql.indexOf("$$;", start) + 3)
}
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema private; create schema auth;
  create function auth.uid() returns uuid language sql as $$
    select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema public,auth to authenticated,anon,service_role;
  create table public.profiles(id uuid primary key, is_admin boolean default false,username text,full_name text);
  grant select on public.profiles to authenticated;
  create table public.listings(id uuid primary key,seller_id uuid references public.profiles(id),
    title text, status text default 'active',is_vip boolean default false,vip_until timestamptz,
    promoted_until timestamptz,featured_until timestamptz,featured_slot int,
    home_banner_until timestamptz,home_banner_slot int);
  create function public.set_updated_at() returns trigger language plpgsql as $$
  begin new.updated_at := clock_timestamp(); return new; end; $$;
  create table public.user_action_rate_limits(user_id uuid,action text,
    window_started_at timestamptz,hits int,primary key(user_id,action));
`)
await db.exec(read("supabase/10_vip_boosts_phase.sql").split("insert into public.listing_boost_products")[0])
await db.exec(`
  alter table public.listing_boost_orders drop constraint listing_boost_orders_payment_method_check;
  alter table public.listing_boost_orders add column payment_provider text,
    add column provider_payment_id text,add column provider_checkout_url text,
    add column provider_status text,add column provider_result_code text,add column placement_slot int;
  create unique index one_pending on public.listing_boost_orders(listing_id,product_id)
    where status in ('pending_payment','under_review','approved');
`)
await db.exec(read("supabase/18_boost_payment_automation.sql"))
await db.exec(extractFunction("supabase/migrations/20260830140238_harden_listing_boosts.sql", "private.reconcile_listing_boost_state"))
await db.exec(extractFunction("supabase/migrations/20260830151727_finalize_listing_boost_security.sql", "public.activate_listing_boost_order"))
await db.exec(read("supabase/migrations/20260907215244_prepare_tbc_launch_readiness.sql"))
await db.exec(read("supabase/migrations/20260907215544_index_tbc_refund_reviewer.sql"))
check(true, "Migration and existing activation/reconciliation functions compile in PostgreSQL")
const seller = randomUUID(), other = randomUUID(), admin = randomUUID()
await db.query("insert into profiles(id,is_admin) values ($1,false),($2,false),($3,true)",[seller,other,admin])
await db.exec("insert into listing_boost_products(id,name,placement,duration_days,price) values ('test-vip','Test VIP','vip',7,10)")
async function makeOrder() {
  const id=randomUUID(), listing=randomUUID(), payId="test-"+id
  await db.query("insert into listings(id,seller_id) values ($1,$2)",[listing,seller])
  await db.query(`insert into listing_boost_orders(id,listing_id,seller_id,product_id,amount,currency,
    payment_method,payment_provider,provider_payment_id,provider_status)
    values ($1,$2,$3,'test-vip',10,'GEL','tbc_checkout','tbc_checkout',$4,'Created')`,[id,listing,seller,payId])
  return {id,listing,payId}
}
async function version(id) { return (await db.query("select updated_at::text as version from listing_boost_orders where id=$1",[id])).rows[0].version }
async function apply(order,status,source="callback",expected,amount=10,currency="GEL") {
  const v=expected ?? await version(order.id)
  return (await db.query("select public.apply_verified_tbc_payment($1,$2,$3,$4,null,$5,$6,$7) as result",
    [order.id,v,order.payId,status,amount,currency,source])).rows[0].result
}
async function row(id) { return (await db.query("select * from listing_boost_orders where id=$1",[id])).rows[0] }
async function countEvents(id,event) { return Number((await db.query("select count(*) as n from listing_boost_order_events where order_id=$1 and event_type=$2",[id,event])).rows[0].n) }
for (const status of ["Created","Processing","PaymentCompletionProcessing","WaitingConfirm","Failed","Expired","CancelPaymentProcessing"]) {
  const order=await makeOrder()
  await apply(order,status)
  check(!(await row(order.id)).paid_at && await countEvents(order.id,"boost_activated")===0, status+" never activates")
}
for (const sources of [["callback","callback"],["callback","return"],["return","callback"],["callback","manual_admin_sync"]]) {
  const order=await makeOrder(), v=await version(order.id)
  const results=await Promise.all(sources.map(source=>apply(order,"Succeeded",source,v)))
  check(results.filter(r=>r.outcome==="applied").length===1, sources.join("+")+" has one version winner")
  const first=await row(order.id)
  await apply(order,"Succeeded","callback")
  const second=await row(order.id)
  check(await countEvents(order.id,"boost_activated")===1 && first.ends_at.getTime()===second.ends_at.getTime(), "Duplicate success preserves one activation and expiry")
  await apply(order,"Processing")
  check((await row(order.id)).provider_status==="Succeeded","Transient response cannot downgrade success")
}
const claimOrder=await makeOrder()
const claims=await Promise.all([1,2].map(()=>db.query("select public.claim_tbc_payment_sync($1) as result",[claimOrder.payId])))
check(claims.filter(r=>r.rows[0].result.outcome==="claimed").length===1,"Concurrent sync claims call bank at most once")
check((await db.query("select public.claim_tbc_payment_sync('unknown') as result")).rows[0].result.outcome==="missing","Unknown payment is not claimed")
for (const [amount,currency] of [[9,"GEL"],[10,"USD"],[null,"GEL"]]) {
  const order=await makeOrder()
  await apply(order,"Succeeded","callback",undefined,amount,currency)
  check((await row(order.id)).status==="under_review" && !((await row(order.id)).paid_at),"Mismatched payment is held for review")
}
const refunded=await makeOrder()
await apply(refunded,"Succeeded")
const refundId=randomUUID()
await db.query("insert into listing_boost_refund_requests(id,order_id,seller_id,amount,currency,reason) values($1,$2,$3,10,'GEL','Service activation issue')",[refundId,refunded.id,seller])
await assert.rejects(db.query("insert into listing_boost_refund_requests(order_id,seller_id,amount,currency,reason) values($1,$2,10,'GEL','Repeated refund request')",[refunded.id,seller]))
check(await countEvents(refunded.id,"refund_requested")===1,"Duplicate refund rejected with one atomic audit event")
const reviews=await Promise.all([1,2].map(()=>db.query("update listing_boost_refund_requests set status='approved',reviewed_by=$2 where id=$1 and status='requested' returning id",[refundId,admin])))
check(reviews.reduce((n,r)=>n+r.rows.length,0)===1 && await countEvents(refunded.id,"refund_approved")===1,"Concurrent admin approval commits once")
check((await row(refunded.id)).provider_status==="Succeeded","Internal approval does not claim money returned")
await apply(refunded,"PartialReturned")
check((await db.query("select status from listing_boost_refund_requests where id=$1",[refundId])).rows[0].status==="partially_refunded","Provider partial return updates refund")
await apply(refunded,"Returned")
await apply(refunded,"Succeeded")
check((await row(refunded.id)).provider_status==="Returned" && (await row(refunded.id)).status==="cancelled","Returned payment never reactivates")
check((await db.query("select status from listing_boost_refund_requests where id=$1",[refundId])).rows[0].status==="refunded","Partial return can become full return")
check((await db.query("select is_vip from listings where id=$1",[refunded.listing])).rows[0].is_vip===false,"Returned payment removes paid boost")
const duplicate=await makeOrder()
await assert.rejects(db.query("update listing_boost_orders set status='active' where id=$1",[duplicate.id]))
check((await row(duplicate.id)).status==="pending_payment","Unverified TBC payment cannot be manually activated")
await assert.rejects(db.query("insert into listing_boost_orders(listing_id,seller_id,product_id,amount) values($1,$2,'test-vip',10)",[duplicate.listing,seller]))
check(await countEvents(duplicate.id,"order_created")===1,"Duplicate checkout order prevented by unique constraint")
check((await db.query("select id from search_admin_payment_orders($1,'all')",[duplicate.id])).rows[0].id===duplicate.id,"Admin search finds exact order across all records")
check((await db.query("select id from search_admin_payment_orders('','returned')")).rows.length===1,"Admin returned filter uses provider state")
await db.query("update listing_boost_orders set created_at=current_timestamp-interval '31 minutes' where id=$1",[duplicate.id])
check((await db.query("select id from search_admin_payment_orders('','stale') where id=$1",[duplicate.id])).rows.length===1,"Admin stale metric uses database time")
for (const role of ["anon","authenticated"]) {
  const privileges=await db.query(`select has_function_privilege($1,'public.apply_verified_tbc_payment(uuid,timestamptz,text,text,text,numeric,text,text)','EXECUTE') as can_apply,
    has_table_privilege($1,'public.listing_boost_refund_requests','UPDATE') as can_review,
    has_table_privilege($1,'public.listing_boost_orders','UPDATE') as can_pay`,[role])
  check(Object.values(privileges.rows[0]).every(v=>v===false),role+" cannot set payment/refund state")
}
await db.exec("set role authenticated")
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other])
check((await db.query("select id from listing_boost_refund_requests")).rows.length===0,"Other seller cannot read refund")
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[seller])
check((await db.query("select id from listing_boost_refund_requests")).rows.length===1,"Owner can read own refund")
await db.exec("reset role")
await db.close()
console.log("DATABASE TESTS PASS:",checks,"checks; no network or production data used")
