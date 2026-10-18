// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getAdminAgentConfig, getAdminAgentStatus, MUSE_SPARK_MODEL_ID } from "@/lib/admin-agent-config"
import { invokeAdminAgent } from "@/lib/admin-agent-provider"
import { invokeMuseSpark } from "@/lib/muse-spark-provider"

const input = { systemPrompt: "READ-ONLY; facts only", context: { metrics: { overdue: 3 } }, conversation: [], message: "პრიორიტეტები?" }
const fetchMock = vi.fn()
beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReset()
  for (const key of ["ADMIN_AGENT_PROVIDER", "ADMIN_AGENT_MODEL", "MUSE_SPARK_MODEL", "OPENAI_API_KEY", "OPENROUTER_API_KEY"]) vi.stubEnv(key, "")
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs() })
function muse() {
  vi.stubEnv("ADMIN_AGENT_PROVIDER", "muse-spark")
  vi.stubEnv("OPENROUTER_API_KEY", "test-muse-secret")
  vi.stubEnv("MUSE_SPARK_MODEL", MUSE_SPARK_MODEL_ID)
}
function success(content: unknown = "3 overdue; გახსენი მოდერაცია", model: string = MUSE_SPARK_MODEL_ID) {
  return Response.json({ model, choices: [{ message: { content } }] })
}

describe("Admin provider configuration", () => {
  it("defaults to OpenAI and exposes only safe status metadata", () => {
    vi.stubEnv("OPENAI_API_KEY", "test-openai-secret")
    expect(getAdminAgentConfig()).toMatchObject({ provider: "openai", configured: true, model: "gpt-5.6-terra" })
    expect(JSON.stringify(getAdminAgentStatus())).not.toContain("test-openai-secret")
    expect(getAdminAgentStatus()).not.toHaveProperty("apiKey")
  })
  it("does not substitute OpenAI for an unknown provider", async () => {
    vi.stubEnv("ADMIN_AGENT_PROVIDER", "typo")
    vi.stubEnv("OPENAI_API_KEY", "secret")
    expect(await invokeAdminAgent(input)).toMatchObject({ reply: null, requestedProvider: null, failure: "invalid_configuration" })
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it.each(["", "openai/another-model", "meta/muse-spark-open:free", "meta/muse-spark-open,openai/other"])("rejects unverified Muse model %s before network", async model => {
    muse(); vi.stubEnv("MUSE_SPARK_MODEL", model)
    expect(getAdminAgentStatus().configured).toBe(false)
    expect((await invokeAdminAgent(input)).failure).toBe("invalid_configuration")
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("fails locally with no key even when another provider key exists", async () => {
    muse(); vi.stubEnv("OPENROUTER_API_KEY", ""); vi.stubEnv("OPENAI_API_KEY", "secret")
    expect((await invokeAdminAgent(input)).failure).toBe("missing_credentials")
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("validates direct Muse invocation as well", async () => {
    expect((await invokeMuseSpark({ ...input, apiKey: "secret", model: "other" })).failure).toBe("invalid_configuration")
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe("Muse HTTP integration and fail-closed fallback", () => {
  beforeEach(muse)
  it("calls the pinned endpoint/model with ZDR, bounded output and timeout", async () => {
    fetchMock.mockResolvedValue(success())
    const result = await invokeAdminAgent(input)
    expect(result).toMatchObject({ requestedProvider: "muse-spark", failure: null, reply: "3 overdue; გახსენი მოდერაცია" })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions")
    expect(options).toMatchObject({ cache: "no-store", redirect: "error", headers: { Authorization: "Bearer test-muse-secret" } })
    expect(options.signal).toBeInstanceOf(AbortSignal)
    const body = JSON.parse(options.body)
    expect(body).toMatchObject({ model: MUSE_SPARK_MODEL_ID, provider: { data_collection: "deny", zdr: true, allow_fallbacks: false }, max_tokens: 1200, stream: false })
    expect(body.tools).toBeUndefined()
    expect(body.models).toBeUndefined()
    expect(options.body).not.toContain("test-muse-secret")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it.each([[401, "authentication_failed"], [403, "authentication_failed"], [402, "budget_exceeded"], [429, "rate_limited"], [500, "unavailable"]])("handles HTTP %s without retry or vendor failover", async (status, failure) => {
    fetchMock.mockResolvedValue(new Response("sensitive upstream body test-muse-secret", { status: Number(status) }))
    expect(await invokeAdminAgent(input)).toMatchObject({ reply: null, failure })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it.each([null, {}, { choices: "bad", model: MUSE_SPARK_MODEL_ID }, { choices: [null], model: MUSE_SPARK_MODEL_ID }])("rejects malformed response %j", async payload => {
    fetchMock.mockResolvedValue(Response.json(payload))
    expect((await invokeAdminAgent(input)).reply).toBeNull()
  })
  it.each(["", "   ", null, { text: "unsafe" }])("rejects empty or non-text answer %j", async content => {
    fetchMock.mockResolvedValue(success(content))
    expect((await invokeAdminAgent(input)).failure).toBe("invalid_response")
  })
  it("rejects a response from a substituted model", async () => {
    fetchMock.mockResolvedValue(success("answer", "meta/other"))
    expect((await invokeAdminAgent(input)).failure).toBe("model_mismatch")
  })
  it("handles invalid JSON without leaking or logging the error", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {})
    fetchMock.mockResolvedValue(new Response("secret malformed JSON"))
    expect((await invokeAdminAgent(input)).reply).toBeNull()
    expect(log).not.toHaveBeenCalled(); log.mockRestore()
  })
  it.each(["TimeoutError", "AbortError", "Error"])("handles %s once", async name => {
    const error = new Error("test-muse-secret"); error.name = name
    fetchMock.mockRejectedValue(error)
    expect((await invokeAdminAgent(input)).failure).toBe(name === "Error" ? "unavailable" : "timeout")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
  it("schedules a 20-second timeout", async () => {
    const timeout = vi.spyOn(AbortSignal, "timeout")
    fetchMock.mockResolvedValue(success())
    await invokeAdminAgent(input)
    expect(timeout).toHaveBeenCalledWith(20_000)
    timeout.mockRestore()
  })
})

describe("OpenAI default regression", () => {
  beforeEach(() => vi.stubEnv("OPENAI_API_KEY", "test-openai-secret"))
  it("preserves Responses API with no tools and disables storage", async () => {
    fetchMock.mockResolvedValue(Response.json({ output: [{ content: [{ type: "output_text", text: "სწორი პასუხი" }] }] }))
    expect(await invokeAdminAgent(input)).toMatchObject({ requestedProvider: "openai", failure: null, reply: "სწორი პასუხი" })
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe("https://api.openai.com/v1/responses")
    expect(JSON.parse(options.body)).toMatchObject({ model: "gpt-5.6-terra", store: false, max_output_tokens: 1200 })
    expect(JSON.parse(options.body).tools).toBeUndefined()
  })
  it.each([{}, { output: "bad" }, { output: [null] }, { output: [{ content: "bad" }] }, { output: [{ content: [{ type: "output_text", text: "  " }] }] }])("does not label fallback as AI for %j", async payload => {
    fetchMock.mockResolvedValue(Response.json(payload))
    expect(await invokeAdminAgent(input)).toMatchObject({ reply: null, failure: "invalid_response" })
  })
  it("returns a local fallback on timeout instead of an HTTP 500", async () => {
    fetchMock.mockRejectedValue(new DOMException("timeout", "TimeoutError"))
    expect((await invokeAdminAgent(input)).failure).toBe("timeout")
  })
})
