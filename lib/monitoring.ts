const monitoringEnabled = String(process.env.MONITORING_LOG_ENABLED || "").trim() === "1"

export function captureServerError(scope: string, error: unknown, extra?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error || "unknown_error")
  const payload = {
    scope,
    message,
    extra: extra ?? {},
    timestamp: new Date().toISOString(),
  }

  if (monitoringEnabled) {
    console.error("[samosell-monitoring]", JSON.stringify(payload))
  } else {
    console.error(`[${scope}]`, message)
  }
}
