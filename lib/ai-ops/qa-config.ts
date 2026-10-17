import "server-only";

export const QA_PROJECT_REF = "ydocqjdjmffysexkzxyc";
export const AI_OPS_PREVIEW_BRANCH = "preview/ai-agents-foundation-20261017";
export const QA_URL = `https://${QA_PROJECT_REF}.supabase.co`;
export type QaReaderEnvironment = {
  VERCEL_ENV?: string;
  VERCEL_TARGET_ENV?: string;
  VERCEL_GIT_COMMIT_REF?: string;
  AI_OPS_QA_URL?: string;
  AI_OPS_QA_DATABASE_URL?: string;
  AI_OPS_KILL_SWITCH?: string;
};
export type QaReaderErrorCode =
  | "environment_blocked"
  | "configuration_missing"
  | "configuration_invalid"
  | "schema_unavailable"
  | "access_denied"
  | "connection_failed";
export class QaReaderError extends Error {
  constructor(public readonly code: QaReaderErrorCode) {
    super(code);
  }
}

/** Exact allowlist: never fall back to the application's Auth database or service key. */
export function getQaReaderConfig(env: QaReaderEnvironment) {
  if (
    env.VERCEL_ENV !== "preview" ||
    (env.VERCEL_TARGET_ENV && env.VERCEL_TARGET_ENV !== "preview") ||
    env.VERCEL_GIT_COMMIT_REF !== AI_OPS_PREVIEW_BRANCH
  ) {
    throw new QaReaderError("environment_blocked");
  }
  if (!env.AI_OPS_QA_URL || !env.AI_OPS_QA_DATABASE_URL)
    throw new QaReaderError("configuration_missing");
  if (env.AI_OPS_QA_URL !== QA_URL)
    throw new QaReaderError("configuration_invalid");
  try {
    const url = new URL(env.AI_OPS_QA_DATABASE_URL);
    if (
      url.protocol !== "postgresql:" ||
      url.hostname !== "aws-0-ap-southeast-1.pooler.supabase.com" ||
      url.port !== "6543" ||
      decodeURIComponent(url.username) !==
        `ai_ops_qa_reader.${QA_PROJECT_REF}` ||
      !url.password ||
      url.pathname !== "/postgres" ||
      url.search ||
      url.hash
    ) {
      throw new QaReaderError("configuration_invalid");
    }
    return {
      connectionString: env.AI_OPS_QA_DATABASE_URL,
      environmentStopped: env.AI_OPS_KILL_SWITCH !== "false",
    };
  } catch {
    throw new QaReaderError("configuration_invalid");
  }
}
