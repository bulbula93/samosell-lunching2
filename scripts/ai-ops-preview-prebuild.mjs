// This verification never connects from Production, local builds, or other Preview branches.
if (
  process.env.VERCEL_ENV === "preview" &&
  process.env.VERCEL_GIT_COMMIT_REF === "preview/ai-agents-foundation-20261017"
) {
  await import("./ai-ops-qa-smoke.mjs");
}
