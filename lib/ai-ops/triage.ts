/**
 * Zero-cost deterministic operations triage.
 * Pure functions only: no model requests, scheduler, database mutations, or secrets.
 */
export type TriageJob = {
  status: string;
  priority: string;
  createdAt: string;
  updatedAt?: string | null;
};
export type TriageApproval = {
  status: string;
  expiresAt: string | null;
};
export type TriageControl = {
  stopped: boolean;
  workerEnabled: boolean;
  schedulerEnabled: boolean;
};
export type TriageFinding = {
  code: "STOPPED" | "CONTROL_UNSAFE" | "DEAD_LETTER" | "STALE_JOB" | "EXPIRED_APPROVAL" | "UNKNOWN_STATE";
  severity: "critical" | "warning" | "info";
  count: number;
  explanation: string;
  nextStep: string;
};

const knownStatuses = new Set(["queued", "leased", "awaiting_approval", "completed", "failed", "dead_letter", "cancelled"]);
const severityOrder = { critical: 0, warning: 1, info: 2 };

export function evaluateAiOpsTriage(input: {
  jobs: readonly TriageJob[];
  approvals: readonly TriageApproval[];
  control: TriageControl;
  nowIso: string;
  staleHours?: number;
}): TriageFinding[] {
  const now = Date.parse(input.nowIso);
  if (!Number.isFinite(now)) throw new Error("Invalid evaluation timestamp");
  const staleHours = input.staleHours ?? 24;
  if (!Number.isFinite(staleHours) || staleHours <= 0 || staleHours > 720) throw new Error("Invalid stale threshold");
  const findings: TriageFinding[] = [];
  const add = (code: TriageFinding["code"], severity: TriageFinding["severity"], count: number, explanation: string, nextStep: string) => {
    if (count > 0) findings.push({ code, severity, count, explanation, nextStep });
  };
  if (input.control.stopped) {
    add("STOPPED", "info", 1, "AI Operations kill switch ჩართულია", "შეინარჩუნე გაჩერებული რეჟიმი, სანამ readiness gate არ დასრულდება");
  }
  if (!input.control.stopped && (!input.control.workerEnabled || !input.control.schedulerEnabled)) {
    add("CONTROL_UNSAFE", "warning", 1, "Control flags არათანმიმდევრულია", "გადაამოწმე worker, scheduler და stop state; ავტომატურად არაფერი ჩართო");
  }
  add("DEAD_LETTER", "critical", input.jobs.filter(j => j.status === "dead_letter").length,
    "Dead-letter დავალებები ხელით განსახილველია", "შეამოწმე წარუმატებლობის მიზეზები; არ გაუშვა ავტომატური retry");
  const threshold = staleHours * 3_600_000;
  const stale = input.jobs.filter(j => ["queued", "leased", "failed", "awaiting_approval"].includes(j.status) &&
    Number.isFinite(Date.parse(j.updatedAt || j.createdAt)) && now - Date.parse(j.updatedAt || j.createdAt) >= threshold).length;
  add("STALE_JOB", "warning", stale, "დავალებები მოსალოდნელზე დიდხანს არის აქტიურ მდგომარეობაში", "გადაამოწმე queue, lease და job history");
  const expired = input.approvals.filter(a => a.status === "pending" && a.expiresAt !== null &&
    Number.isFinite(Date.parse(a.expiresAt)) && Date.parse(a.expiresAt) <= now).length;
  add("EXPIRED_APPROVAL", "warning", expired, "დამტკიცების მოთხოვნებს ვადა გაუვიდა", "მოითხოვე ახალი, მოქმედების შესაბამისი დადასტურება");
  const unknown = input.jobs.filter(j => !knownStatuses.has(j.status)).length;
  add("UNKNOWN_STATE", "warning", unknown, "უცნობი job status დაფიქსირდა", "შეამოწმე schema და state machine-ის შესაბამისობა");
  return findings.sort((a,b) => severityOrder[a.severity] - severityOrder[b.severity] || b.count - a.count);
}
