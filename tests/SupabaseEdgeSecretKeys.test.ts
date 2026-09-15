import { describe, expect, it } from "vitest"
import { readDefaultSupabaseSecretKey } from "@/supabase/functions/_shared/supabase-secret"

describe("Supabase Edge Function secret-key configuration", () => {
  it("reads the default secret key from the runtime JSON object", () => {
    expect(readDefaultSupabaseSecretKey(JSON.stringify({ default: "  test-secret-key  " }))).toBe("test-secret-key")
  })

  it.each([
    ["missing object", undefined, "supabase_secret_keys_missing"],
    ["malformed JSON", "{", "supabase_secret_keys_invalid"],
    ["array value", "[]", "supabase_secret_keys_invalid"],
    ["missing default", "{}", "supabase_default_secret_key_missing"],
    ["empty default", JSON.stringify({ default: "   " }), "supabase_default_secret_key_missing"],
    ["non-string default", JSON.stringify({ default: 123 }), "supabase_default_secret_key_missing"],
  ])("fails closed for %s", (_case, raw, expectedError) => {
    expect(() => readDefaultSupabaseSecretKey(raw)).toThrowError(expectedError)
  })
})
