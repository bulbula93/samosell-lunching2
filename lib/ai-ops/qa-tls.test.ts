// @vitest-environment node
import { X509Certificate } from "node:crypto"
import { describe, expect, it } from "vitest"
import { QA_DATABASE_TLS } from "./qa-tls.mjs"
describe("QA TLS trust", () => {
  it("pins the public Supabase CA and keeps certificate/hostname verification on", () => {
    const certificate = new X509Certificate(QA_DATABASE_TLS.ca)
    expect(certificate.ca).toBe(true)
    expect(certificate.fingerprint256.replaceAll(":", "").toLowerCase()).toBe("807025ad50d4ed219d2c9c7d299c004f824eb00cf7f65afef607d07b72e6cafa")
    expect(QA_DATABASE_TLS.rejectUnauthorized).toBe(true)
    expect(QA_DATABASE_TLS).not.toHaveProperty("checkServerIdentity")
  })
})
