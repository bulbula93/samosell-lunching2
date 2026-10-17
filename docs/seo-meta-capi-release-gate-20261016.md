# SEO metadata diagnostics and Meta CAPI activation gate

## Production SEO (opt-in; no request values logged)

The catalog metadata builder emits a single structured log per metadata evaluation
only when `VERCEL_ENV=production` and `SEO_METADATA_DIAGNOSTICS_ENABLED=true`.
The log reports route class/canonical path, parameter count, array flags, the
SEO builder's index decision, final metadata robots index decision, and reason.
It does **not** record parameter values, search terms, UTM, cookies, user IDs or tokens.

1. On Preview, validate clean catalog categories return `index, follow` in HTML,
   and filtered variants return `noindex, follow`.
2. Only after approval to release this instrumentation, temporarily enable the
   diagnostic flag in Production, redeploy, and request clean category paths.
3. Read grouped Vercel runtime logs for `[catalog-seo-diagnostic]`. If builder
   returns index=true while HTML has noindex, investigate Next rendering,
   streaming, response modifications and runtime/deployment differences.
4. Disable the flag and redeploy as soon as evidence is captured. Do not
   change index rules blindly.

## Meta CAPI activation — BLOCKED pending readiness

Do **not** activate or send test events without verifying:
- `GROWTH_TRACKING_ENABLED=true` for the correct deployment.
- `META_CAPI_ENABLED` remains off until approved test.
- Server-only `META_CAPI_ACCESS_TOKEN` is provisioned (never disclose).
- `META_PIXEL_ID` is present, matches `NEXT_PUBLIC_META_PIXEL_ID` where configured.
- `META_GRAPH_API_VERSION` uses a supported explicit `vN.0` value.
- The Events Manager dataset/pixel and access rights are confirmed.
- A separate test environment with an **isolated non-production Supabase project**
  is ready, including `PREVIEW_GROWTH_DATABASE_REF` and `META_TEST_EVENT_CODE`.
- Consent is explicitly granted for analytics and marketing before sending.
- Verify one `CompleteRegistration` event with consistent `event_id` across
  browser pixel and server CAPI, deduplicated by Meta.
- Verify no email/IP/user agent/card information enters payload; ensure
  idempotency, retry/lease, consent revocation, and no duplicate events.
- After test passes, obtain explicit owner approval for Production CAPI enabling.

Read-only Preview cannot complete registration or emit CAPI; do not bypass it.
Do not backfill unverified historical Meta attribution or create Production
test accounts. Existing Production events with no Meta attempts do not prove
whether CAPI secrets are missing; check effective environment safely.
