import { cleanupAuthorized, createStoryCleanupClient, runStoryCleanup } from "@/lib/story-cleanup"

export const runtime = "nodejs"
export const maxDuration = 60

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" }
  if (!cleanupAuthorized(request.headers.get("authorization"), process.env.STORY_CLEANUP_SECRET)) {
    return Response.json({ error: "unauthorized" }, { status: 401, headers })
  }
  if (process.env.STORY_CLEANUP_ENABLED !== "true" || process.env.VERCEL_ENV !== "production") {
    return Response.json({ error: "disabled" }, { status: 503, headers })
  }
  try {
    const result = await runStoryCleanup(createStoryCleanupClient())
    console.info("story_cleanup", result)
    return Response.json(result, { headers })
  } catch {
    console.error("story_cleanup_failed")
    return Response.json({ error: "cleanup_failed" }, { status: 500, headers })
  }
}
