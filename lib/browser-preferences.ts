export const CONSENT_COOKIE = "samosell_browser_consent"
export const CONSENT_KEY = "samosell:browser-consent:v1"
export const PREFERENCES_EVENT = "samosell:preferences-changed"
export const SETTINGS_EVENT = "samosell:open-browser-settings"
export const PERSONALIZATION_KEYS = ["samosell-recently-viewed", "samosell:catalog-filters:v1"]
export const CONSENT_TTL_MS = 180 * 24 * 60 * 60 * 1000
export const PREFERENCE_TTL_MS = 30 * 24 * 60 * 60 * 1000
export type BrowserConsent = { version: 1; personalization: boolean; analytics: boolean; updatedAt: number }
let memoryConsent: string | null = null

export function parseConsent(raw: string | null): BrowserConsent | null {
  try {
    const value = JSON.parse(raw ?? "null")
    if (value?.version !== 1 || typeof value.personalization !== "boolean" || typeof value.analytics !== "boolean" ||
      !Number.isFinite(value.updatedAt) || value.updatedAt > Date.now() || Date.now() - value.updatedAt > CONSENT_TTL_MS) return null
    return value
  } catch { return null }
}

export function cookieConsent(header: string | null) {
  const raw = header?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${CONSENT_COOKIE}=`))
  try { return parseConsent(raw ? decodeURIComponent(raw.slice(CONSENT_COOKIE.length + 1)) : null) }
  catch { return null }
}

export function consentSnapshot() {
  if (typeof window === "undefined") return ""
  try { return window.localStorage.getItem(CONSENT_KEY) ?? (cookieConsent(document.cookie) ? JSON.stringify(cookieConsent(document.cookie)) : "") }
  catch { return memoryConsent ?? "" }
}

export function getBrowserConsent() { return parseConsent(consentSnapshot()) }
export function allowsPersonalization() { return getBrowserConsent()?.personalization === true }
export function allowsAnalytics() { return getBrowserConsent()?.analytics === true }

export function subscribePreferences(listener: () => void) {
  window.addEventListener("storage", listener)
  window.addEventListener(PREFERENCES_EVENT, listener)
  return () => {
    window.removeEventListener("storage", listener)
    window.removeEventListener(PREFERENCES_EVENT, listener)
  }
}

export function saveBrowserConsent(personalization: boolean, analytics: boolean) {
  const value: BrowserConsent = { version: 1, personalization, analytics, updatedAt: Date.now() }
  const raw = JSON.stringify(value)
  memoryConsent = raw
  try { document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(raw)}; Path=/; Max-Age=${CONSENT_TTL_MS / 1000}; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}` }
  catch { /* Respect the choice in this tab even if cookies are blocked. */ }
  try {
    window.localStorage.setItem(CONSENT_KEY, raw)
    if (!personalization) PERSONALIZATION_KEYS.forEach((key) => window.localStorage.removeItem(key))
  } catch { /* Storage can be disabled; honor the selection for this tab. */ }
  window.dispatchEvent(new Event(PREFERENCES_EVENT))
  window.dispatchEvent(new Event("recently-viewed-updated"))
  return value
}

export function readPreference<T>(key: string): T | null {
  if (!allowsPersonalization()) return null
  try {
    const value = JSON.parse(window.localStorage.getItem(key) ?? "null")
    if (!value || !Number.isFinite(value.expiresAt) || value.expiresAt <= Date.now()) return null
    return value.data as T
  } catch { return null }
}

export function writePreference(key: string, data: unknown) {
  if (!allowsPersonalization()) return false
  try {
    window.localStorage.setItem(key, JSON.stringify({ data, expiresAt: Date.now() + PREFERENCE_TTL_MS }))
    window.dispatchEvent(new Event(PREFERENCES_EVENT))
    return true
  } catch { return false }
}

export function removePreference(key: string) {
  try { window.localStorage.removeItem(key) } catch { /* ignore unavailable storage */ }
  window.dispatchEvent(new Event(PREFERENCES_EVENT))
}
