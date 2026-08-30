import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  reportPriority,
  reportPriorityLabel,
  reportPriorityScore,
} from "@/lib/moderation"

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8")
}

const safetyPanel = read("components/moderation/ListingSafetyActions.tsx")
const adminQueue = read("app/admin/reports/page.tsx")

describe("phase 8 moderation UX", () => {
  it("keeps reporting and blocking semantically separate inside one safety panel", () => {
    expect(safetyPanel).toContain("რეპორტი ან დაბლოკვა")
    expect(safetyPanel).toContain("რეპორტი იგზავნება SamoSell-ის მოდერაციაში")
    expect(safetyPanel).toContain("ავტომატურად ანგარიშის შეზღუდვას არ ნიშნავს")
    expect(safetyPanel).toContain("<ReportListingForm")
    expect(safetyPanel).toContain("<ReportUserForm")
    expect(safetyPanel).toContain("<BlockUserForm")
  })

  it("classifies safety-critical reasons as high priority", () => {
    expect(reportPriority("listing", "prohibited")).toBe("high")
    expect(reportPriority("listing", "fake")).toBe("high")
    expect(reportPriority("user", "scam")).toBe("high")
    expect(reportPriority("user", "harassment")).toBe("high")
    expect(reportPriority("user", "impersonation")).toBe("high")
    expect(reportPriority("listing", "spam")).toBe("normal")
    expect(reportPriorityLabel("high")).toBe("მაღალი რისკი")
    expect(reportPriorityScore("high")).toBeGreaterThan(reportPriorityScore("normal"))
  })

  it("provides a combined queue, risk filter, and repeated-target triage signals", () => {
    expect(adminQueue).toContain('type QueueKind = "all" | "listing" | "user"')
    expect(adminQueue).toContain('type PriorityFilter = "all" | "high"')
    expect(adminQueue).toContain("ყველა სიგნალი")
    expect(adminQueue).toContain("მხოლოდ მაღალი რისკი")
    expect(adminQueue).toContain("listingTargetCounts")
    expect(adminQueue).toContain("userTargetCounts")
    expect(adminQueue).toContain("reportPriorityScore")
  })
})
