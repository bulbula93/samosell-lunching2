import { beforeEach,describe,expect,it,vi } from "vitest"
const mocks=vi.hoisted(()=>({admin:vi.fn(),capture:vi.fn()}))
vi.mock("@/lib/auth",()=>({requireAdminUser:mocks.admin}))
vi.mock("@/lib/monitoring",()=>({captureServerError:mocks.capture}))
import { POST as agent } from "@/app/api/admin/agent/route"
import { POST as telemetry } from "@/app/api/monitoring/client-error/route"
beforeEach(()=>{ vi.clearAllMocks(); mocks.admin.mockResolvedValue({supabase:{}}) })
const req=(path:string,body:string,origin="https://samosell.ge")=>new Request("https://samosell.ge"+path,{
  method:"POST",headers:{"content-type":"application/json",origin},body,
})
describe("privileged API and logging boundaries",()=>{
  it("rejects cross-origin admin requests before authentication or data access",async()=>{
    expect((await agent(req("/api/admin/agent",'{"message":"hello"}',"https://attacker.invalid"))).status).toBe(403)
    expect(mocks.admin).not.toHaveBeenCalled()
  })
  it("bounds admin payloads before processing history or contacting a model",async()=>{
    expect((await agent(req("/api/admin/agent",JSON.stringify({message:"x".repeat(40000)})))).status).toBe(413)
  })
  it("rejects malformed admin bodies",async()=>{
    expect((await agent(req("/api/admin/agent","{"))).status).toBe(400)
  })
  it("bounds client telemetry and rejects cross-origin traffic",async()=>{
    expect((await telemetry(req("/api/monitoring/client-error","x".repeat(9000)))).status).toBe(413)
    expect((await telemetry(req("/api/monitoring/client-error","{}","https://attacker.invalid"))).status).toBe(403)
    expect(mocks.capture).not.toHaveBeenCalled()
  })
  it("does not retain raw messages, source URLs, tokens or arbitrary client fields",async()=>{
    const response=await telemetry(req("/api/monitoring/client-error",JSON.stringify({
      type:"unhandledrejection",message:"private test credential",token:"private token",source:"https://example.invalid?token=private",
    })))
    expect(response.status).toBe(200)
    const extra=mocks.capture.mock.calls[0][2]
    expect(extra.type).toBe("unhandledrejection")
    expect(extra.fingerprint).toMatch(/^[a-f0-9]{16}$/)
    expect(JSON.stringify(mocks.capture.mock.calls)).not.toContain("private")
  })
})
