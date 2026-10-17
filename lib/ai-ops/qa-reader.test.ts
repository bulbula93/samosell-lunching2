// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getQaReaderConfig, AI_OPS_PREVIEW_BRANCH, QA_URL } from "./qa-config";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  profile: vi.fn(),
  connect: vi.fn(),
  query: vi.fn(),
  end: vi.fn(),
  constructed: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: mocks.profile }) }),
    }),
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));
vi.mock("pg", () => ({
  Client: class {
    constructor(options: unknown) {
      mocks.constructed(options);
    }
    connect = mocks.connect;
    query = mocks.query;
    end = mocks.end;
  },
}));
import { readQaOperations } from "./qa-reader";
import AiPage from "@/app/admin/ai/page";
import ActivityPage from "@/app/admin/ai/activity/page";
import ShadowPage from "@/app/admin/ai/shadow/page";

const valid = {
  VERCEL_ENV: "preview",
  VERCEL_GIT_COMMIT_REF: AI_OPS_PREVIEW_BRANCH,
  AI_OPS_QA_URL: QA_URL,
  AI_OPS_QA_DATABASE_URL:
    "postgresql://ai_ops_qa_reader.ydocqjdjmffysexkzxyc:test-password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres",
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  for (const [key, value] of Object.entries(valid)) vi.stubEnv(key, value);
  mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-test" } } });
  mocks.profile.mockResolvedValue({ data: { is_admin: true } });
  mocks.end.mockResolvedValue(undefined);
  mocks.query.mockImplementation(async (sql: string) => {
    if (sql.includes("current_user"))
      return { rows: [{ role: "ai_ops_qa_reader" }] };
    if (sql.startsWith("SELECT stopped"))
      return { rows: [{ stopped: true, updated_at: "2026-10-17T10:00:00Z" }] };
    if (sql.includes("count(*)"))
      return { rows: [{ jobs: 0, activity: 0, pending: 0 }] };
    return { rows: [] };
  });
});
describe("QA connection boundary", () => {
  it("requires this exact preview branch and QA project", () => {
    for (const override of [
      { VERCEL_ENV: "production" },
      { VERCEL_TARGET_ENV: "production" },
      { VERCEL_ENV: "development" },
      { VERCEL_GIT_COMMIT_REF: "main" },
      { VERCEL_GIT_COMMIT_REF: undefined },
      { AI_OPS_QA_URL: "https://lxsvjzbiuewgwpajqrwr.supabase.co" },
    ])
      expect(() => getQaReaderConfig({ ...valid, ...override })).toThrow();
    expect(getQaReaderConfig(valid).environmentStopped).toBe(true);
  });
  it("rejects alternate hosts, credentials, production refs and connection options", () => {
    for (const url of [
      valid.AI_OPS_QA_DATABASE_URL.replace(
        "ydocqjdjmffysexkzxyc",
        "lxsvjzbiuewgwpajqrwr",
      ),
      valid.AI_OPS_QA_DATABASE_URL.replace("ai_ops_qa_reader.", "postgres."),
      valid.AI_OPS_QA_DATABASE_URL.replace(
        "aws-0-ap-southeast-1.pooler.supabase.com",
        "evil.example",
      ),
      valid.AI_OPS_QA_DATABASE_URL + "?sslmode=no-verify",
      valid.AI_OPS_QA_DATABASE_URL + "#anything",
      "sb_secret_not_a_database_url",
    ])
      expect(() =>
        getQaReaderConfig({ ...valid, AI_OPS_QA_DATABASE_URL: url }),
      ).toThrow();
  });
  it("never falls back to the existing Supabase URL or service role", async () => {
    vi.stubEnv("AI_OPS_QA_DATABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "private-test-value");
    expect(await readQaOperations()).toEqual({
      ok: false,
      code: "configuration_missing",
    });
    expect(mocks.constructed).not.toHaveBeenCalled();
  });
});
describe("real admin authorization before every QA read", () => {
  it("redirects unauthenticated users from all three pages without opening QA", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    for (const page of [AiPage, ActivityPage, ShadowPage])
      await expect(page()).rejects.toThrow("REDIRECT:/login?");
    expect(mocks.constructed).not.toHaveBeenCalled();
  });
  it("denies non-admin and profile failures from all pages", async () => {
    for (const profile of [
      { data: { is_admin: false } },
      { data: null, error: { code: "error" } },
    ]) {
      mocks.profile.mockResolvedValue(profile);
      for (const page of [AiPage, ActivityPage, ShadowPage])
        await expect(page()).rejects.toThrow("REDIRECT:/dashboard");
    }
    expect(mocks.constructed).not.toHaveBeenCalled();
  });
  it("reads bounded metadata for an admin over verified TLS in a read-only transaction", async () => {
    expect(await readQaOperations()).toMatchObject({
      ok: true,
      data: { jobs: [], environmentStopped: true, control: { stopped: true } },
    });
    expect(mocks.constructed).toHaveBeenCalledWith(
      expect.objectContaining({ ssl: { rejectUnauthorized: true } }),
    );
    expect(mocks.query.mock.calls[0][0]).toBe(
      "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    );
    expect(mocks.query.mock.calls.at(-1)?.[0]).toBe("COMMIT");
    expect(mocks.end).toHaveBeenCalledOnce();
  });
  it("redacts connection failures and closes the connection", async () => {
    mocks.connect.mockRejectedValue(new Error(valid.AI_OPS_QA_DATABASE_URL));
    expect(await readQaOperations()).toEqual({
      ok: false,
      code: "connection_failed",
    });
    expect(mocks.end).toHaveBeenCalledOnce();
  });
  it("fails closed on schema errors or missing kill-switch row", async () => {
    mocks.query.mockRejectedValueOnce({ code: "42P01", message: "secret" });
    expect(await readQaOperations()).toEqual({
      ok: false,
      code: "schema_unavailable",
    });
    mocks.query.mockResolvedValue({ rows: [{ role: "ai_ops_qa_reader" }] });
    expect(await readQaOperations()).toEqual({
      ok: false,
      code: "schema_unavailable",
    });
  });
  it("does not create jobs on repeated reads", async () => {
    await readQaOperations();
    await readQaOperations();
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
    for (const [sql] of mocks.query.mock.calls)
      expect(sql).not.toMatch(/\b(insert|update|delete|truncate|call)\b/i);
  });
});
