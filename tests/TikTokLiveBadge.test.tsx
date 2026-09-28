import React from "react"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import TikTokLiveBadge from "@/components/shared/TikTokLiveBadge"
import {
  buildTikTokLiveUrl,
  isTikTokLiveActive,
  normalizeTikTokUsername,
} from "@/lib/tiktok"

describe("TikTok LIVE integration", () => {
  it("normalizes usernames and builds the LIVE URL", () => {
    expect(normalizeTikTokUsername("@SamoSell.Store")).toBe("samosell.store")
    expect(normalizeTikTokUsername("https://www.tiktok.com/@SamoSell.Store/")).toBe("samosell.store")
    expect(buildTikTokLiveUrl("@samosell")).toBe("https://www.tiktok.com/@samosell/live")
  })

  it("only shows the LIVE badge while the timestamp is active", () => {
    const { rerender } = render(
      <TikTokLiveBadge username="samosell" liveUntil="2099-01-01T00:00:00.000Z" />,
    )

    expect(screen.getByRole("link", { name: /TikTok LIVE-ის გახსნა/ })).toHaveAttribute(
      "href",
      "https://www.tiktok.com/@samosell/live",
    )

    rerender(<TikTokLiveBadge username="samosell" liveUntil="2020-01-01T00:00:00.000Z" />)
    expect(screen.queryByRole("link", { name: /TikTok LIVE-ის გახსნა/ })).not.toBeInTheDocument()
    expect(isTikTokLiveActive("2020-01-01T00:00:00.000Z")).toBe(false)
  })

  it("uses a four-hour authenticated LIVE window without a cleanup cron", () => {
    const migration = readFileSync(
      join(process.cwd(), "supabase", "migrations", "20260928144455_add_tiktok_live_badge.sql"),
      "utf8",
    )

    expect(migration).toContain("set_tiktok_live_status")
    expect(migration).toContain("now() + interval '4 hours'")
    expect(migration).toContain("where id = v_user_id")
    expect(migration).toContain("grant execute on function public.set_tiktok_live_status")
    expect(migration).not.toContain("cron.schedule")
  })
})
