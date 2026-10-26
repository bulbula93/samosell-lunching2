import { readFile } from "node:fs/promises"
import { createClient } from "@supabase/supabase-js"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"

const url = "https://ydocqjdjmffysexkzxyc.supabase.co"
const key = "sb_publishable_GimAu7-NHZn6fbQdl0rTmA_vaDHd4MM"
const credentials = JSON.parse(await readFile(process.env.SECURITY_QA_CREDENTIALS, "utf8"))
const clients = []
for (const c of credentials) {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
  assert(!(await client.auth.signInWithPassword(c)).error, "QA authentication")
  clients.push(client)
}
const [a,b,admin] = clients
const [A,B,C] = credentials.map(c => c.id)
const anon = createClient(url, key, { auth: { persistSession: false } })
const results = []
const flags = { is_admin: true, is_suspended: true, is_seller_verified: true }
// User B's generated profile is removed explicitly by the QA fixture setup.
const existing = await b.from("profiles").select("id").eq("id",B).maybeSingle()
if (!existing.data) assert(!(await b.from("profiles").insert({ id:B,...flags })).error, "Own profile insert")
assert(!(await a.from("profiles").update(flags).eq("id",A)).error, "Own profile update")
for (const [client,id] of [[a,A],[b,B]]) {
  const row = await client.from("profiles").select("is_admin,is_suspended,is_seller_verified").eq("id",id).single()
  assert(!row.error && Object.values(row.data).every(v=>v===false), "Privilege flags must remain false")
}
results.push("Profile INSERT/UPDATE privileged flags normalized: PASS")
const badProfile = await b.from("profiles").update({full_name:"unauthorized"}).eq("id",A).select("id")
assert(!badProfile.error && badProfile.data.length===0)
assert(!(await a.from("profiles").update({bio:"QA disposable bio",seller_type:"store"}).eq("id",A)).error)
results.push("Cross-user profile/store update DENIED; own store profile update PASS")
const category = await a.from("categories").select("id").eq("is_active",true).limit(1).single()
assert(!category.error)
const listingId = randomUUID()
const created = await a.from("listings").insert({id:listingId,seller_id:A,category_id:category.data.id,title:"Security QA disposable",description:"Disposable security audit fixture description",slug:"security-qa-"+listingId,price:10,status:"draft",cover_image_url:url+"/storage/v1/object/public/avatars/"+A+"/qa-fixture.png"}).select("id").single()
assert(!created.error, "Own draft listing creation: "+JSON.stringify(created.error))
try {
  const changed = await b.from("listings").update({title:"unauthorized"}).eq("id",listingId).select("id")
  assert(!changed.error && changed.data.length===0)
  assert((await b.from("listings").select("id").eq("id",listingId)).data?.length===0)
  assert((await anon.from("listings").select("id").eq("id",listingId)).data?.length===0)
  assert((await a.from("listings").update({is_vip:true}).eq("id",listingId)).error)
  assert(!(await a.from("listings").update({title:"Security QA own edit"}).eq("id",listingId)).error)
  results.push("Listing IDOR and unauthorized VIP DENIED; owner edit PASS")
  const chat = await a.rpc("open_profile_direct_chat",{p_recipient_id:C})
  assert(!chat.error && typeof chat.data==="string", "Own direct chat")
  const message = await a.rpc("send_chat_message",{p_chat_id:chat.data,p_body:"Disposable security QA message",p_client_request_id:randomUUID()})
  assert(!message.error, "Participant message")
  assert((await b.from("chats").select("id").eq("id",chat.data)).data?.length===0)
  assert((await b.from("messages").select("id").eq("chat_id",chat.data)).data?.length===0)
  assert((await b.rpc("send_chat_message",{p_chat_id:chat.data,p_body:"unauthorized",p_client_request_id:randomUUID()})).error)
  assert((await b.rpc("mark_chat_read",{p_chat_id:chat.data})).data===false)
  results.push("Private chat/message IDOR and unauthorized send DENIED; participant send PASS")
  const administrative = [
    ["admin_manage_user",{p_user_id:A,p_action:"suspend",p_note:"QA"}],
    ["admin_manage_listing",{p_listing_id:listingId,p_action:"hide",p_note:"QA"}],
    ["admin_update_category",{p_category_id:category.data.id,p_name:"QA",p_navigation_label:"QA",p_sort_order:1,p_is_active:true,p_note:"QA"}],
    ["review_moderation_report",{p_report_kind:"listing",p_report_id:randomUUID(),p_decision:"dismissed",p_moderation_note:"QA"}],
    ["review_story_report",{p_report_id:randomUUID(),p_decision:"dismissed",p_moderation_note:"QA"}],
  ]
  for (const [name,args] of administrative) {
    assert((await b.rpc(name,args)).error, name+" non-admin denied")
    assert((await anon.rpc(name,args)).error, name+" anonymous denied")
  }
  assert(!(await admin.rpc("admin_manage_user",{p_user_id:A,p_action:"verify",p_note:"Disposable QA verification"})).error)
  assert((await a.from("profiles").select("is_seller_verified").eq("id",A).single()).data.is_seller_verified===true)
  assert(!(await admin.rpc("admin_manage_user",{p_user_id:A,p_action:"unverify",p_note:"Disposable QA cleanup"})).error)
  results.push("Anonymous/non-admin administrative RPCs DENIED; admin verify/unverify PASS")
  for (const client of [anon,a,b]) assert((await client.rpc("marketing_growth_snapshot")).error)
  for (const name of ["flitt_payment_attempts","listing_boost_orders","ad_orders","admin_audit_log"]) {
    const read = await b.from(name).select("*").limit(1)
    assert(read.error || read.data.length===0, name+" non-admin data boundary")
  }
  assert((await b.rpc("finalize_flitt_boost_payment",{p_boost_order_id:listingId})).error)
  assert((await b.rpc("finalize_flitt_ad_payment",{p_ad_order_id:listingId})).error)
  results.push("Internal metrics and payment finalizers DENIED; private admin/payment tables protected")
  const orderId = "8a772fea-77ec-46eb-b2fe-36552fd439a4"
  assert((await b.from("marketplace_orders").select("id").eq("id",orderId)).data?.length===0)
  assert((await a.from("marketplace_orders").select("id").eq("id",orderId)).data?.length===1)
  assert((await b.rpc("transition_marketplace_order",{p_order_id:orderId,p_next_status:"paid",p_expected_updated_at:new Date().toISOString()})).data?.length===0)
  assert((await a.from("marketplace_orders").update({status:"paid"}).eq("id",orderId)).error)
  const nId="20b9815f-0884-43bc-a5f1-736ed10722f4"
  assert((await b.from("notifications").select("id").eq("id",nId)).data?.length===0)
  assert((await a.from("notifications").select("id").eq("id",nId)).data?.length===1)
  assert((await b.rpc("mark_notification_read",{p_notification_id:nId})).data===false)
  results.push("Order/notification IDOR DENIED; owner reads PASS; direct paid status DENIED")

} finally {
  assert(!(await a.from("listings").delete().eq("id",listingId)).error, "Disposable listing cleanup")
}
for (const client of clients) await client.auth.signOut({scope:"local"})
console.log(JSON.stringify({target:url,results},null,2))
