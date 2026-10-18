import { describe, expect, it } from "vitest";
import { evaluateAiOpsTriage } from "../lib/ai-ops/triage";

const now = "2026-10-18T12:00:00.000Z";
const stopped = { stopped: true, workerEnabled: false, schedulerEnabled: false };

describe("zero-cost AI Operations triage", () => {
  it("treats the kill switch as a safe informational state", () => {
    const r = evaluateAiOpsTriage({ jobs: [], approvals: [], control: stopped, nowIso: now });
    expect(r.map(x => x.code)).toEqual(["STOPPED"]);
  });
  it("identifies failures, stale leases and expired approvals deterministically", () => {
    const r = evaluateAiOpsTriage({
      jobs: [
        { status:"dead_letter", priority:"critical", createdAt:"2026-10-17T00:00:00Z" },
        { status:"leased", priority:"high", createdAt:"2026-10-17T00:00:00Z" },
        { status:"completed", priority:"normal", createdAt:"2026-10-15T00:00:00Z" }
      ],
      approvals: [{ status:"pending", expiresAt:"2026-10-18T10:00:00Z" }],
      control: stopped, nowIso: now
    });
    expect(r.map(x => x.code)).toEqual(["DEAD_LETTER", "STALE_JOB", "EXPIRED_APPROVAL", "STOPPED"]);
  });
  it("does not label future approvals or fresh jobs as overdue", () => {
    expect(evaluateAiOpsTriage({
      jobs: [{status:"queued",priority:"low",createdAt:now}],
      approvals:[{status:"pending",expiresAt:"2026-10-19T00:00:00Z"}],
      control: {stopped:false,workerEnabled:true,schedulerEnabled:true},nowIso:now
    })).toEqual([]);
  });
  it("rejects invalid time and thresholds instead of producing fake results", () => {
    expect(() => evaluateAiOpsTriage({jobs:[],approvals:[],control:stopped,nowIso:"bad"})).toThrow();
    expect(() => evaluateAiOpsTriage({jobs:[],approvals:[],control:stopped,nowIso:now,staleHours:-1})).toThrow();
  });
});
