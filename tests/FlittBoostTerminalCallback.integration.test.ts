// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest"

const state=vi.hoisted(()=>({
  provider:vi.fn(),
  verify:vi.fn(),
  finalizer:vi.fn(),
  cancel:vi.fn(),
  update:vi.fn(),
  lookup:vi.fn(),
}))
vi.mock("@/lib/flitt",()=>({
  getFlittReadiness:()=>({mode:"live"}),
  validateFlittCallback:state.verify,
  fetchFlittOrderStatus:state.provider,
}))
vi.mock("@/lib/flitt-ad",()=>({
  finalizeFlittAdPayment:vi.fn(),reverseFlittAdPayment:vi.fn(),failFlittAdPayment:vi.fn(),
}))
vi.mock("@/lib/flitt-boost",()=>({
  finalizeFlittBoostPayment:state.finalizer,
  reverseFlittBoostPayment:vi.fn(),
  reconcileUnpaidFlittBoostFailure:state.cancel,
}))
vi.mock("@/lib/supabase/admin",()=>({
  createAdminClient:()=>({
    from:()=>({
      select:()=>({eq:()=>({maybeSingle:state.lookup})}),
      update:(payload:Record<string,unknown>)=>({
        eq:async()=>state.update(payload),
      }),
    }),
  }),
}))

import { POST } from "@/app/api/payments/flitt/callback/route"

const payment={
 order_id:"test-boost",
 boost_order_id:"12345678-1234-4123-8123-123456789abc",
 ad_order_id:null,
 amount:990,currency:"GEL",merchant_id:"1234",
 provider_payment_id:"gateway-123",
 provider_verified_at:null,provider_verification_source:null,
 status:"pending",callback_count:0,mode:"live",purpose:"boost_order",
}
function callbackRequest(){
 return new Request("https://samosell.ge/api/payments/flitt/callback",{
  method:"POST",headers:{"content-type":"application/json"},
  body:JSON.stringify({order_id:"test-boost",signature:"signed-provider-payload"}),
 })
}
beforeEach(()=>{
 state.provider.mockReset().mockResolvedValue({
   nextStatus:"expired",providerStatus:"expired",responseStatus:"success",paymentId:"gateway-123",
 })
 state.verify.mockReset().mockReturnValue({ok:true})
 state.finalizer.mockReset().mockResolvedValue({status:"active"})
 state.cancel.mockReset().mockResolvedValue({reconciled:true})
 state.update.mockReset().mockResolvedValue({error:null})
 state.lookup.mockReset().mockResolvedValue({data:payment,error:null})
})

describe("Flitt live callback HTTP path — isolated gateway & database simulations",()=>{
 it("cancels a verified expired checkout without activating VIP",async()=>{
  const res=await POST(callbackRequest())
  expect(res.status).toBe(200)
  expect(state.verify).toHaveBeenCalledOnce()
  expect(state.provider).toHaveBeenCalledOnce()
  expect(state.update).toHaveBeenCalledWith(expect.objectContaining({
    status:"expired",provider_status:"expired",response_status:"success",
  }))
  expect(state.cancel).toHaveBeenCalledWith(payment.boost_order_id,expect.objectContaining({nextStatus:"expired"}))
  expect(state.finalizer).not.toHaveBeenCalled()
 })
 it("only activates VIP after authoritative approval",async()=>{
  state.provider.mockResolvedValueOnce({
    nextStatus:"approved",providerStatus:"approved",responseStatus:"success",paymentId:"gateway-123",
  })
  const res=await POST(callbackRequest())
  expect(res.status).toBe(200)
  expect(state.finalizer).toHaveBeenCalledWith(payment.boost_order_id)
  expect(state.cancel).not.toHaveBeenCalled()
 })
 it("rejects invalid signed callback before hitting the gateway",async()=>{
  state.verify.mockReturnValueOnce({ok:false,reason:"invalid_signature"})
  const res=await POST(callbackRequest())
  expect(res.status).toBe(400)
  expect(state.provider).not.toHaveBeenCalled()
  expect(state.finalizer).not.toHaveBeenCalled()
  expect(state.cancel).not.toHaveBeenCalled()
 })
 it("fails closed when the terminal cancellation cannot be persisted",async()=>{
  state.cancel.mockRejectedValueOnce(Error("database outage"))
  const res=await POST(callbackRequest())
  expect(res.status).toBe(500)
  expect(state.finalizer).not.toHaveBeenCalled()
 })
})
