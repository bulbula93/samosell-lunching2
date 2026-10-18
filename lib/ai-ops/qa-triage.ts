import type { QaSnapshot } from "./qa-reader";
import { evaluateAiOpsTriage } from "./triage";

/** The DB controls the external QA worker; the web environment flag does not. */
export function evaluateQaSnapshotTriage(data: QaSnapshot, nowIso: string) {
  return evaluateAiOpsTriage({
    jobs: data.jobs.map((job) => ({
      status: job.status,
      priority: job.priority,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    })),
    approvals: data.approvals.map((approval) => ({
      status: approval.status,
      expiresAt: approval.expires_at,
    })),
    control: {
      stopped: data.control.stopped,
      workerEnabled: data.control.worker_enabled,
      schedulerEnabled: data.control.scheduler_enabled,
    },
    nowIso,
  });
}
