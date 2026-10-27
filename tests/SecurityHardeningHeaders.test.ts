import { describe,expect,it } from "vitest"
import { isSameOriginMutation, SECURITY_HEADERS } from "@/lib/security-headers"
describe("security response headers and cookie mutations",()=>{
  it("rolls CSP out without enforcing it or allowing eval",()=>{
    const headers=Object.fromEntries(SECURITY_HEADERS.map(h=>[h.key,h.value]))
    expect(headers["Content-Security-Policy"]).toBeUndefined()
    expect(headers["Content-Security-Policy-Report-Only"]).toContain("object-src 'none'")
    expect(headers["Content-Security-Policy-Report-Only"]).not.toContain("unsafe-eval")
    expect(headers["Strict-Transport-Security"]).toBe("max-age=63072000")
  })
  it.each([null,"null","https://attacker.invalid","https://samosell.ge.attacker.invalid"])("rejects origin %s",origin=>{
    const headers: Record<string,string>={}
    if(origin) headers.origin=origin
    expect(isSameOriginMutation(new Request("https://samosell.ge/api/admin/agent",{headers}))).toBe(false)
  })
  it("allows existing same-origin browser requests",()=>{
    expect(isSameOriginMutation(new Request("https://samosell.ge/api/admin/agent",{headers:{origin:"https://samosell.ge","sec-fetch-site":"same-origin"}}))).toBe(true)
  })
})
