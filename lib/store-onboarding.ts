import { getSafeAuthRedirectPath } from "@/lib/auth-redirect"

export const STORE_SETUP_PATH = "/dashboard/store/setup"

export function isStoreSetupPath(path: string | null | undefined) {
  const url = new URL(getSafeAuthRedirectPath(path), "https://samosell.ge")
  return url.pathname === STORE_SETUP_PATH ||
    (url.pathname === "/dashboard/profile" && url.searchParams.get("setup") === "store")
}

export function getStoreSetupContinuePath(path: string | null | undefined) {
  const safePath = getSafeAuthRedirectPath(path, "/dashboard")
  return safePath === "/" || isStoreSetupPath(safePath) ||
    /^\/(?:register|login|auth)(?:[/?#]|$)/.test(safePath)
    ? "/dashboard"
    : safePath
}

export function getStoreSetupPath(nextPath?: string | null) {
  if (isStoreSetupPath(nextPath)) {
    const url = new URL(getSafeAuthRedirectPath(nextPath), "https://samosell.ge")
    nextPath = url.searchParams.get("next")
  }
  const next = getStoreSetupContinuePath(nextPath)
  return next === "/dashboard" ? STORE_SETUP_PATH : `${STORE_SETUP_PATH}?next=${encodeURIComponent(next)}`
}

export function getRegistrationContinuePath(sellerType: "individual" | "store", nextPath?: string) {
  if (sellerType === "store") return getStoreSetupPath(nextPath)
  return isStoreSetupPath(nextPath)
    ? getStoreSetupContinuePath(new URL(getSafeAuthRedirectPath(nextPath), "https://samosell.ge").searchParams.get("next"))
    : getSafeAuthRedirectPath(nextPath)
}
