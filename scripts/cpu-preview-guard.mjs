// Fail before Next prerenders if this experiment loses its QA-only overrides.
if (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_GIT_COMMIT_REF === "preview/cpu-optimization-20261102") {
  const qa = "https://ydocqjdjmffysexkzxyc.supabase.co"
  if (process.env.NEXT_PUBLIC_SUPABASE_URL !== qa || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_") || process.env.NEXT_PUBLIC_PREVIEW_READ_ONLY !== "true") {
    throw new Error("CPU_PREVIEW_QA_CONFIGURATION_REQUIRED")
  }
  if (["SUPABASE_SERVICE_ROLE_KEY", "RESEND_API_KEY", "OPENAI_API_KEY", "FLITT_SECRET_KEY", "TBC_CLIENT_SECRET", "TBC_API_KEY", "META_CAPI_ACCESS_TOKEN", "META_ADS_ACCESS_TOKEN", "AI_OPS_QA_DATABASE_URL"].some(key => process.env[key]?.trim())) {
    throw new Error("CPU_PREVIEW_PRIVILEGED_CREDENTIALS_FORBIDDEN")
  }
  console.info("[cpu-preview] QA target verified; read-only; privileged credentials absent")
}
