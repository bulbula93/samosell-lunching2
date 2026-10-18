// Run explicitly in the authorized Preview build. No customer/financial writes or test users.
import { Client } from "pg";
import { QA_DATABASE_TLS } from "../lib/ai-ops/qa-tls.mjs";
const ref = "ydocqjdjmffysexkzxyc";
const branch = "preview/ai-agents-foundation-20261017";
let client;
try {
  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.VERCEL_GIT_COMMIT_REF !== branch ||
    process.env.AI_OPS_QA_URL !== `https://${ref}.supabase.co`
  )
    throw { code: "TARGET_BLOCKED" };
  const url = new URL(process.env.AI_OPS_QA_DATABASE_URL);
  if (
    url.protocol !== "postgresql:" ||
    url.hostname !== "aws-0-ap-southeast-1.pooler.supabase.com" ||
    url.port !== "6543" ||
    url.username !== `ai_ops_qa_reader.${ref}` ||
    url.pathname !== "/postgres" ||
    url.search ||
    url.hash
  )
    throw { code: "CONFIG_BLOCKED" };
  client = new Client({
    connectionString: url.toString(),
    ssl: QA_DATABASE_TLS,
    connectionTimeoutMillis: 10000,
    statement_timeout: 5000,
    query_timeout: 7000,
    application_name: "samosell-ai-ops-qa-smoke",
  });
  await client.connect();
  await client.query("BEGIN READ ONLY");
  const {
    rows: [identity],
  } = await client.query(
    "SELECT current_user AS role, session_user AS session, current_setting('transaction_read_only') AS readonly",
  );
  if (
    identity.role !== "ai_ops_qa_reader" ||
    identity.session !== "ai_ops_qa_reader" ||
    identity.readonly !== "on"
  )
    throw { code: "ROLE_BLOCKED" };
  const {
    rows: [control],
  } = await client.query(
    "SELECT stopped,worker_enabled,scheduler_enabled,last_tick_at::text,last_tick_status FROM public.ai_ops_control WHERE singleton=true",
  );
  if (!control || typeof control.stopped !== "boolean" || typeof control.worker_enabled !== "boolean" || typeof control.scheduler_enabled !== "boolean") throw { code: "CONTROL_INVALID" };
  // The QA-only 24h test may intentionally be active. Validate the control shape and
  // least-privilege reader; do not mutate or interrupt QA in a deployment smoke check.
  for (const table of [
    "ai_ops_jobs",
    "ai_ops_activity",
    "ai_ops_approvals",
    "ai_ops_control",
  ]) {
    const {
      rows: [privileges],
    } = await client.query(
      "SELECT has_table_privilege(current_user,$1,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS writes",
      [`public.${table}`],
    );
    if (privileges.writes) throw { code: "WRITE_PRIVILEGES" };
  }
  const {
    rows: [privateAccess],
  } = await client.query(
    "SELECT has_table_privilege(current_user,'public.profiles','SELECT') AS profiles, has_column_privilege(current_user,'public.ai_ops_activity','details','SELECT') AS details, pg_has_role(current_user,'service_role','MEMBER') AS elevated",
  );
  if (privateAccess.profiles || privateAccess.details || privateAccess.elevated)
    throw { code: "EXCESS_PRIVILEGES" };
  const {
    rows: [definers],
  } = await client.query(
    "SELECT count(*)::int AS count FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE p.prosecdef AND n.nspname NOT IN ('pg_catalog','information_schema') AND has_function_privilege(current_user,p.oid,'EXECUTE')",
  );
  if (definers.count !== 0) throw { code: "DEFINER_PRIVILEGES" };
  const jobs = await client.query(
    "SELECT id,role,kind,status,priority,attempt,created_at::text,updated_at::text FROM public.ai_ops_jobs ORDER BY created_at DESC,id DESC LIMIT 20",
  );
  const activity = await client.query(
    "SELECT id,role,event_type,created_at::text FROM public.ai_ops_activity ORDER BY sequence DESC LIMIT 30",
  );
  const approvals = await client.query(
    "SELECT id,action,status,requested_at::text,expires_at::text FROM public.ai_ops_approvals ORDER BY (status='pending') DESC,requested_at DESC,id DESC LIMIT 20",
  );
  await client.query("ROLLBACK");
  console.log(
    JSON.stringify({
      check: "ai-ops-qa-smoke",
      status: "passed",
      project: ref,
      role: identity.role,
      stopped: control.stopped,
      workerEnabled: control.worker_enabled,
      schedulerEnabled: control.scheduler_enabled,
      sampled: {
        jobs: jobs.rowCount,
        activity: activity.rowCount,
        approvals: approvals.rowCount,
      },
      tls: "verified",
      writes: "denied",
    }),
  );
} catch (error) {
  // Intentionally omit messages, stack traces, URLs, and credentials from build logs.
  const code =
    typeof error?.code === "string" && /^[A-Z0-9_]{2,40}$/.test(error.code)
      ? error.code
      : "CONNECTION_FAILED";
  console.error(
    JSON.stringify({ check: "ai-ops-qa-smoke", status: "failed", code }),
  );
  process.exitCode = 1;
} finally {
  await client?.end().catch(() => undefined);
}
