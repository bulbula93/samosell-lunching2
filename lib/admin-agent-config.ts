import "server-only"

// Verified at https://openrouter.ai/meta/muse-spark-open on 2026-10-18.
export const MUSE_SPARK_MODEL_ID = "meta/muse-spark-open"
export type AdminAgentProvider = "openai" | "muse-spark"

export function getAdminAgentConfig() {
  const selected = String(process.env.ADMIN_AGENT_PROVIDER ?? "").trim() || "openai"
  const provider: AdminAgentProvider | null =
    selected === "openai" || selected === "muse-spark" ? selected : null
  const apiKey = String(provider === "muse-spark"
    ? process.env.OPENROUTER_API_KEY ?? ""
    : provider === "openai" ? process.env.OPENAI_API_KEY ?? "" : "").trim()
  const model = String(provider === "muse-spark"
    ? process.env.MUSE_SPARK_MODEL ?? ""
    : process.env.ADMIN_AGENT_MODEL || "gpt-5.6-terra").trim()
  const validModel = provider === "muse-spark"
    ? model === MUSE_SPARK_MODEL_ID
    : /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(model)
  const issue: "invalid_configuration" | "missing_credentials" | null = !provider || !validModel ? "invalid_configuration" : !apiKey ? "missing_credentials" : null
  return { provider, apiKey, model, issue, configured: issue === null }
}

// The only configuration serialized into RSC/client props. Never include credentials.
export function getAdminAgentStatus() {
  const { provider, configured, issue } = getAdminAgentConfig()
  return {
    provider,
    name: provider === "muse-spark" ? "Muse Spark Open" : provider === "openai" ? "OpenAI Responses API" : "Invalid provider",
    configured,
    issue,
  }
}
