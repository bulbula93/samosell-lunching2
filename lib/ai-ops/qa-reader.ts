import "server-only";
import { Client } from "pg";
import { requireAdminUser } from "@/lib/auth";
import {
  getQaReaderConfig,
  QaReaderError,
  type QaReaderErrorCode,
} from "./qa-config";

export type QaJob = {
  id: string;
  role: string;
  kind: string;
  status: string;
  priority: string;
  attempt: number;
  created_at: string;
};
export type QaActivity = {
  id: string;
  role: string;
  event_type: string;
  created_at: string;
};
export type QaApproval = {
  id: string;
  action: string;
  status: string;
  requested_at: string;
  expires_at: string;
  expired: boolean;
};
export type QaSnapshot = {
  jobs: QaJob[];
  activity: QaActivity[];
  approvals: QaApproval[];
  control: { stopped: boolean; updated_at: string };
  totals: { jobs: number; activity: number; pending: number };
  environmentStopped: boolean;
};
export type QaReadResult =
  | { ok: true; data: QaSnapshot }
  | { ok: false; code: QaReaderErrorCode };

function safeErrorCode(error: unknown): QaReaderErrorCode {
  if (error instanceof QaReaderError) return error.code;
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? error.code
      : undefined;
  if (code === "42P01" || code === "42703") return "schema_unavailable";
  if (code === "42501" || code === "28P01" || code === "28000")
    return "access_denied";
  return "connection_failed";
}

/** No API/action is exported. Authorization happens on EVERY read, before config or connection. */
export async function readQaOperations(): Promise<QaReadResult> {
  await requireAdminUser("/dashboard"); // Redirect errors must escape; never turn denied access into data.
  let client: Client | undefined;
  try {
    const config = getQaReaderConfig({
      VERCEL_ENV: process.env.VERCEL_ENV,
      VERCEL_TARGET_ENV: process.env.VERCEL_TARGET_ENV,
      VERCEL_GIT_COMMIT_REF: process.env.VERCEL_GIT_COMMIT_REF,
      AI_OPS_QA_URL: process.env.AI_OPS_QA_URL,
      AI_OPS_QA_DATABASE_URL: process.env.AI_OPS_QA_DATABASE_URL,
      AI_OPS_KILL_SWITCH: process.env.AI_OPS_KILL_SWITCH,
    });
    client = new Client({
      connectionString: config.connectionString,
      ssl: { rejectUnauthorized: true },
      connectionTimeoutMillis: 5000,
      statement_timeout: 5000,
      query_timeout: 7000,
      application_name: "samosell-ai-ops-qa-reader",
    });
    await client.connect();
    await client.query(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    const identity = await client.query<{ role: string }>(
      "SELECT current_user AS role",
    );
    if (identity.rows[0]?.role !== "ai_ops_qa_reader")
      throw new QaReaderError("access_denied");
    // Fixed SQL only. No query input, RPCs, SELECT *, details payloads, or writes.
    const jobs = await client.query<QaJob>(
      "SELECT id, role, kind, status, priority, attempt, created_at::text FROM public.ai_ops_jobs ORDER BY created_at DESC, id DESC LIMIT 20",
    );
    const activity = await client.query<QaActivity>(
      "SELECT id, role, event_type, created_at::text FROM public.ai_ops_activity ORDER BY created_at DESC, id DESC LIMIT 30",
    );
    const approvals = await client.query<QaApproval>(
      "SELECT id, action, status, requested_at::text, expires_at::text, (expires_at <= transaction_timestamp()) AS expired FROM public.ai_ops_approvals ORDER BY (status = 'pending') DESC, requested_at DESC, id DESC LIMIT 20",
    );
    const control = await client.query<QaSnapshot["control"]>(
      "SELECT stopped, updated_at::text FROM public.ai_ops_control WHERE singleton = true",
    );
    if (
      control.rows.length !== 1 ||
      typeof control.rows[0].stopped !== "boolean"
    )
      throw new QaReaderError("schema_unavailable");
    const totals = await client.query<QaSnapshot["totals"]>(
      "SELECT (SELECT count(*)::int FROM public.ai_ops_jobs) AS jobs, (SELECT count(*)::int FROM public.ai_ops_activity) AS activity, (SELECT count(*)::int FROM public.ai_ops_approvals WHERE status = 'pending') AS pending",
    );
    await client.query("COMMIT");
    return {
      ok: true,
      data: {
        jobs: jobs.rows,
        activity: activity.rows,
        approvals: approvals.rows,
        control: control.rows[0],
        totals: totals.rows[0],
        environmentStopped: config.environmentStopped,
      },
    };
  } catch (error) {
    // Never expose driver messages, connection strings, credentials or raw database errors.
    return { ok: false, code: safeErrorCode(error) };
  } finally {
    // Closing also rolls back an unfinished read-only transaction. A failed close must not leak errors.
    await client?.end().catch(() => undefined);
  }
}
