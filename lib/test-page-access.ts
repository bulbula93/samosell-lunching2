import { requireAdminUser } from "@/lib/auth"

export async function ensureInternalTestPageAccess() {
  if (process.env.NODE_ENV === "development") return
  await requireAdminUser("/dashboard")
}
