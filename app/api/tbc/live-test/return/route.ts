import { NextResponse } from "next/server"
import { requireAdminUser } from "@/lib/auth"
import { getSiteUrlEnv } from "@/lib/env"
import { syncTbcAdminLiveTestByAttemptId } from "@/lib/tbc-admin-live-test"

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function liveTestUrl(params: Record<string, string>) {
  const url = new URL("/admin/payments/tbc-live-test", getSiteUrlEnv())
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url
}

export async function GET(request: Request) {
  const { user } = await requireAdminUser("/dashboard")
  const attemptId = String(
    new URL(request.url).searchParams.get("attempt") ?? "",
  ).trim()

  if (!UUID_PATTERN.test(attemptId)) {
    return NextResponse.redirect(
      liveTestUrl({ error: "Live test attempt ID არასწორია." }),
    )
  }

  try {
    const result = await syncTbcAdminLiveTestByAttemptId(attemptId)

    return NextResponse.redirect(
      liveTestUrl({
        attempt: attemptId,
        returned: "1",
        ok:
          result.status === "succeeded"
            ? "TBC 1 ₾ გადახდა წარმატებით დადასტურდა."
            : `TBC დაბრუნდა სტატუსით: ${result.providerStatus || result.status}.`,
      }),
    )
  } catch (error) {
    console.error(
      "[tbc-live-test] return sync failed",
      error instanceof Error ? error.message : "unknown error",
      "admin",
      user.id,
    )

    return NextResponse.redirect(
      liveTestUrl({
        attempt: attemptId,
        returned: "1",
        error:
          "ბანკიდან დაბრუნება მიღებულია, მაგრამ სტატუსის გადამოწმება ვერ შესრულდა. გამოიყენე Refresh status.",
      }),
    )
  }
}
