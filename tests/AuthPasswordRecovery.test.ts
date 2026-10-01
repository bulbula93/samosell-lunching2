import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

describe("password recovery auth flow", () => {
  const login = read("components/auth/LoginForm.tsx")
  const forgot = read("components/auth/ForgotPasswordForm.tsx")
  const reset = read("components/auth/ResetPasswordForm.tsx")
  const callback = read("app/auth/callback/route.ts")
  const forgotPage = read("app/forgot-password/page.tsx")
  const resetPage = read("app/reset-password/page.tsx")

  it("shows a Georgian retry message for invalid credentials", () => {
    expect(login).toContain("ელფოსტა ან პაროლი არასწორია. ცადე თავიდან.")
    expect(login).toContain('href="/forgot-password"')
  })

  it("sends recovery email through the auth callback without revealing account existence", () => {
    expect(forgot).toContain("resetPasswordForEmail")
    expect(forgot).toContain('redirectUrl.searchParams.set("next", "/reset-password")')
    expect(forgot).toContain("თუ ამ ელფოსტით ანგარიში არსებობს")
    expect(forgotPage).toContain("ForgotPasswordForm")
  })

  it("requires a recovery session before setting a new password", () => {
    expect(resetPage).toContain('redirect("/forgot-password?error=invalid_or_expired")')
    expect(reset).toContain("updateUser({ password })")
    expect(reset).toContain('signOut({ scope: "local" })')
  })

  it("routes failed recovery callbacks back to a fresh recovery request", () => {
    expect(callback).toContain('if (next === "/reset-password")')
    expect(callback).toContain('recoveryUrl.searchParams.set("error", "invalid_or_expired")')
  })
})
