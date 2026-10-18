# Muse Spark Open — Admin Copilot provider

Status: **NOT READY for Production** until live provider and authenticated Preview gates pass. PR #123 stays Draft. No Production merge/deploy is authorized.

## Architecture and scope

`/admin/agent` → existing `requireAdminUser()` → bounded read-only snapshot → `buildAdminAgentModelContext()` → server-only provider router. OpenAI is the default. Explicit `muse-spark` selects only Muse Spark Open on OpenRouter. Unknown providers, incorrect model IDs, missing credentials, timeouts and invalid responses fail closed to the local deterministic snapshot. There is no automatic model/vendor substitution or retry loop.

The provider has no tools, SQL, RPC, Server Actions or write handlers. The existing `/admin/ai` QA metadata reader, policies, jobs, approvals and inactive workers are unchanged. No schema, payment configuration, user records, or Supabase credentials are modified by this integration. Human approval for mutations is a future separately audited capability; this Copilot cannot execute a mutation even if the chat asks it to.

## Audit fixes

- Share configuration validation across the API, snapshot readiness and both admin pages. Unknown provider values cannot silently select OpenAI.
- Pin the exact verified Muse model in requests and verify response identity; reject alternatives and model suffixes.
- Preserve OpenAI Responses API/default model. Disable OpenAI response storage with `store:false` (this does not assert account-level ZDR).
- Configure OpenRouter with `data_collection:"deny"`, `zdr:true`, and `allow_fallbacks:false`. An unavailable eligible endpoint returns local fallback; privacy is never relaxed automatically.
- Bound requests to 80,000 bytes, messages to 4,000 characters, eight history items to 1,600 characters each, output to 1,200 tokens/8,000 characters and provider calls to 20 seconds. Reject cross-origin browser requests and non-JSON bodies. Forbid HTTP redirects when sending credentials.
- Keep authentication redirects outside application error handling. Reject anonymous/non-admin requests before snapshots or paid inference.
- Return `mode`, actual `provider`, `requestedProvider`, `connection`, bounded failure category and latency. Empty OpenAI responses and timeout errors are deterministic fallback, not AI success/HTTP 500.
- Log only static event names and validated provider/failure/latency metadata. Never log upstream bodies, request IDs, headers, prompts, keys or raw exceptions. Responses use `Cache-Control:no-store`.
- Show API NOT VERIFIED initially, AI CONNECTED only after a real successful answer, fallback reason after provider failure, and REQUEST FAILED after network errors. Credit/license attribution: Built with Muse Spark Open.

## Official provider evidence (checked 2026-10-18)

| Item | Finding / source |
| --- | --- |
| Meta hosting ecosystem | Model catalogs: AWS SageMaker AI, Google Cloud Model Garden, Microsoft Foundry; inference platforms: Baseten, Fireworks, Groq, Modal, Nebius, Together; gateway: OpenRouter. https://dev.meta.ai/docs/muse-spark-open |
| Endpoint | `POST https://openrouter.ai/api/v1/chat/completions`; `Authorization: Bearer <server-only key>`. https://openrouter.ai/docs/quickstart |
| Exact model | `meta/muse-spark-open`. Current endpoint catalog lists Modal, Together, Nebius, Fireworks and Baseten; availability varies. https://openrouter.ai/api/v1/models/meta/muse-spark-open/endpoints |
| Published price | $1.25 / 1M input tokens; $4.25 / 1M output tokens; some endpoints list $0.15 / 1M cache-read tokens. https://openrouter.ai/meta/muse-spark-open |
| Rate limits / budget | Account/key credit caps, in-flight budgets, DDoS controls and upstream capacity. Account-specific numbers require authenticated `GET /api/v1/key`; no fixed unverified RPM is assumed. https://openrouter.ai/docs/api/reference/limits |
| Latency | Public model page is a rolling observation, not a service guarantee. SamoSell latency remains unmeasured until live benchmark; hard request deadline is 20 seconds. |
| Commercial license | Muse Model License permits commercial use, subject to Usage Policy and attribution. It requires Built with Muse Spark Open in UI/documentation/site/settings. The separate >$20M Model-as-a-Service clause excludes internal use and own-product features; confirm applicability with counsel if scope changes. https://huggingface.co/meta-models/Muse-Spark-Open-816B-A42B/blob/main/LICENSE.md |
| Gateway privacy | OpenRouter prompt retention is opt-in. Private logging and use-for-improvement defaults are off; verify actual account toggles. Anonymous categorization is documented separately. https://openrouter.ai/docs/guides/privacy/data-collection |
| Upstream privacy | Per-request ZDR and data-policy filters are enforced. These restrict eligible endpoints and can reduce availability. Verify actual provider policy and OpenRouter account logging; do not infer universal zero retention. https://openrouter.ai/docs/guides/routing/provider-selection |
| Georgia | **Not verified** for this account. OpenRouter terms note originating-country reporting may affect model access; a cloud/Vercel request does not prove access from a Georgian network. Verify account access/billing and, if needed, one request from Georgia. https://openrouter.ai/terms |

## Preview configuration

Only branch `preview/muse-spark-admin-agent-20261018` receives:

```dotenv
ADMIN_AGENT_PROVIDER=openai
MUSE_SPARK_MODEL=meta/muse-spark-open
# Securely enter OPENROUTER_API_KEY as a sensitive server-only Preview variable.
```

The first two non-secret variables were provisioned for this branch. OpenAI stays selected pending real Muse validation. No key is checked in, output to chat or stored in public variables. Do not copy a Production key to a new provider.

After secure key setup, temporarily select `ADMIN_AGENT_PROVIDER=muse-spark` **on this Preview branch only**, redeploy, run synthetic tests and authenticated UI verification, then preserve OpenAI as release default. Production environment variables must stay unchanged until final owner approval. Do not switch the application's shared Supabase/Auth project just to test inference; use synthetic inputs for provider tests and no fixture writes to Production.

## Validation

Runtime tests cover configuration, exact model validation, malformed/empty responses, 401/403/402/429/5xx, timeout/network errors, no automatic retries/substitution, no raw error logging, existing OpenAI behavior, unauthorized/non-admin pages and API, request bounds/origin checks, safe context projection and connection UI.

Local complete suite initially passed: 189 files / 1,101 tests. After final authorization additions, rerun and record final count. TypeScript and Next production build pass with non-routable build-only Supabase config; this proves compilation, not DB connectivity. Full ESLint has 0 errors / 8 pre-existing image warnings in unchanged files. Local Node is v24.19.0; repository CI uses Node 22 and is the release authority. Lockfile/dependencies are unchanged. Package install under the host's pnpm 11 objected to the repository's existing build-approval placeholders; direct installed binaries ran checks without changing those policies.

Live tests are **skipped by default**. With secure keys in the test process, run:

```bash
ADMIN_AGENT_LIVE_TEST=true node_modules/.bin/vitest run tests/AdminAgentLiveIntegration.test.ts
```

This sends six paid requests (OpenAI + Muse × three synthetic read-only scenarios): priority ordering, moderation backlog, payments/system health. No DB imports or real customer data. It records provider, scenario, elapsed time, failure category and synthetic answer. Human review must compare numeric faithfulness, Georgian quality, partial-data disclosure and absence of mutation claims. Record actual billed usage/cost from provider dashboards; latency alone is not cost evidence. Never enable this flag globally in CI or log credentials.

## Illustrative cost (not measured)

Assume each call bills 2,500 input + 600 output tokens, no cache savings, no retries, and 30 days/month. Per-call cost is `(2500×1.25 + 600×4.25)/1e6 = $0.005675`.

| Requests/day | Requests/month | Muse token charge/month |
| --- | ---: | ---: |
| 10 | 300 | $1.70 |
| 30 | 900 | $5.11 |
| 100 | 3,000 | $17.03 |

These exclude taxes, credit-purchase fees, hosting and other agents. History length and billed reasoning tokens change usage. Real comparison with the existing OpenAI model is pending authenticated usage evidence. Require a dedicated capped API key before Production; application token limits are not a global monthly spend cap.

## Future AI Operations use — all disabled in this release

| Agent | Possible Muse scope | Required independent gate |
| --- | --- | --- |
| Moderation | Text/image triage and draft reasons | Image safety/adversarial dataset, false-positive review, privacy, human approval for listing/account changes |
| Listing Assistant | Photo-to-description draft | Image permissions, accuracy, Georgian quality, seller review before publish |
| Support | Draft replies from approved knowledge | PII redaction, prompt injection, escalation, human approval before sending |
| SEO | Category/listing drafts | Fact/SEO review, no invented product claims, approval before publishing |
| Analytics | Aggregated metrics interpretation | Numeric fidelity, partial-data handling, no raw customer records |
| Development/QA | Code review/test proposals | Isolated execution, secret scanning, repository permissions, approval before merge/deploy |

## Production release gate

Keep PR Draft / NOT READY until all required latest-commit CI checks and Preview build pass; actual Muse/OpenAI synthetic tests pass; authenticated `/admin/agent` and `/admin/system` checks pass; fallbacks and admin authorization pass; logging/secret review passes; key budget/rate/privacy/region checks are recorded. Final owner consent is still required after every gate is met. No live success or cost comparison may be claimed from mocked tests or environment variable presence.
