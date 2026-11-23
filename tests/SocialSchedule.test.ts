// @vitest-environment node
/** The pg_cron publish tick must run right after every plan slot (feed and Story), in UTC. */
import { readdirSync, readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { STORY_DELAY_MINUTES } from "@/lib/social/agents/creative"
import { weekSlotTimes } from "@/lib/social/agents/strategy"

function latestTickSchedule() {
  const files = readdirSync("supabase/migrations").filter(f => f.endsWith(".sql")).sort()
  let schedule: string | null = null
  for (const f of files) {
    const sql = readFileSync(`supabase/migrations/${f}`, "utf8")
    const m = /cron\.schedule\(\s*'samosell-social-publish-tick',\s*'([^']+)'/.exec(sql)
    if (m) schedule = m[1]
  }
  return schedule
}

describe("posting schedule", () => {
  it("slots are Mon/Thu/Sun 21:00 and Fri/Sat 15:00 Tbilisi", () => {
    const local = weekSlotTimes("2026-11-30").map(iso => new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tbilisi", weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso)))
    expect(local).toEqual(["Mon 21:00", "Thu 21:00", "Fri 15:00", "Sat 15:00", "Sun 21:00"])
  })
  it("the latest publish-tick cron runs 5 minutes after every feed and Story slot", () => {
    const schedule = latestTickSchedule()
    expect(schedule).toBeTruthy()
    const [minute, hours] = schedule!.split(" ")
    expect(minute).toBe("5")
    const tickHours = new Set(hours.split(",").map(Number))
    for (const iso of weekSlotTimes("2026-11-30")) {
      const feed = new Date(iso)
      const story = new Date(feed.getTime() + STORY_DELAY_MINUTES * 60_000)
      expect(feed.getUTCMinutes()).toBe(0)
      expect(tickHours.has(feed.getUTCHours())).toBe(true)
      expect(tickHours.has(story.getUTCHours())).toBe(true)
    }
  })
})
