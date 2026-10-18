# Muse Spark Open — optional Admin Copilot provider

This change adds Muse Spark Open inference as an **opt-in** provider for the existing read-only /admin/agent route. It does not enable autonomous agents, write access, billing, or database migrations.

## Setup (Preview only)
Set these **server-only** Vercel Preview environment variables:
- `ADMIN_AGENT_PROVIDER=muse-spark`
- `OPENROUTER_API_KEY` to your hosted provider key
- `MUSE_SPARK_MODEL` to the exact Muse Spark Open model identifier **available in your OpenRouter account**

Do not use `NEXT_PUBLIC_` for any key. If the provider/key/model is unavailable, requests return the existing deterministic fallback, not a fabricated AI reply. The 20-second timeout is preserved. Without `ADMIN_AGENT_PROVIDER=muse-spark`, the existing OpenAI behavior remains unchanged.

## Acceptance checks
1. Run `npx vitest run tests/AdminAiCopilotPhase1.test.ts tests/MuseSparkProvider.test.ts`, `npx tsc --noEmit`, lint and production build.
2. Validate in Vercel Preview using a non-sensitive read-only Admin Copilot prompt.
3. Confirm OpenAI default unaffected, Muse connected returns AI mode, and invalid credentials return fallback without logging secrets.
4. Check model quality, latency, cost, privacy/data retention and availability before enabling in Production.

**No automatic provider failover:** admin metrics are not sent to a second AI vendor after errors; fallback remains local and deterministic.
