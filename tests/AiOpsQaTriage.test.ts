import { describe, expect, it } from "vitest";
import type { QaSnapshot } from "@/lib/ai-ops/qa-reader";
import { evaluateQaSnapshotTriage } from "@/lib/ai-ops/qa-triage";

const now = "2026-10-18T12:00:00Z";
const snapshot: QaSnapshot = {
  jobs: [], activity: [], approvals: [],
  totals: { jobs: 100, activity: 300, pending: 0 },
  environmentStopped: true,
  control: { stopped: false, worker_enabled: true, scheduler_enabled: true,
    updated_at: now, last_tick_at: now, last_tick_status: "completed" },
};

describe("QA snapshot triage integration", () => {
  it("uses DB control even while the web environment kill switch is set", () => {
    expect(evaluateQaSnapshotTriage(snapshot, now)).toEqual([]);
    expect(evaluateQaSnapshotTriage({ ...snapshot, environmentStopped: false,
      control: { ...snapshot.control, stopped: true } }, now).map(f => f.code)).toEqual(["STOPPED"]);
  });
  it("uses last update instead of creation time and ignores completed jobs", () => {
    const job = { id: "old-job", role: "technical", kind: "shadow_technical",
      priority: "normal", attempt: 1, created_at: "2026-10-15T00:00:00Z" };
    const findings = evaluateQaSnapshotTriage({ ...snapshot, jobs: [
      { ...job, status: "queued", updated_at: now },
      { ...job, id: "stale-job", status: "leased", updated_at: "2026-10-17T12:00:00Z" },
      { ...job, id: "done-job", status: "completed", updated_at: "2026-10-15T00:00:00Z" },
    ] }, now);
    expect(findings.map(f => [f.code, f.count])).toEqual([["STALE_JOB", 1]]);
  });
  it("does not use whole-database totals as sample finding counts", () => {
    expect(evaluateQaSnapshotTriage(snapshot, now)).toEqual([]);
  });
});
