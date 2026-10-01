import "server-only"
import { cookies } from "next/headers"
import { CONSENT_COOKIE, cookieConsent } from "@/lib/browser-preferences"

export async function serverAllowsAnalytics() {
  const store = await cookies()
  return cookieConsent(`${CONSENT_COOKIE}=${store.get(CONSENT_COOKIE)?.value ?? ""}`)?.analytics === true
}
