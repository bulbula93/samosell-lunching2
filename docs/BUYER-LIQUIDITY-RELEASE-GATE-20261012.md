# SamoSell — Buyer Liquidity Analytics Release Gate (2026-10-12)

**Status:** PREPARED, NOT RELEASED. Approval required to mutate production schema or merge to main.

## Scope / dependency order
1. PR #105 `preview/liquidity-measurement-20261012`: detail-page daily distinct views, rate quotas, signed HttpOnly cookie.
2. Stacked Catalog PR: catalog viewport impressions and primary-card clicks. No user-facing layout copy changes.
3. SQL migrations **in filename order**:
   - `20261012110000_listing_view_daily.sql`
   - `20261012130000_catalog_engagement.sql`

## Confirmed release inputs
- Vercel project: `prj_R9brlTc5RoXFHDGuhKdcvdMRZEQz` (team `team_8xV00BDFp9xfIUl4faO29wy1`).
- Repository: `bulbula93/samosell-lunching2`. Production branch: `main`.
- Preview #105 SHA `0969c41a89a8dc0d44db154952f5071df691c8b4`, Vercel deployment `dpl_CHAZiEwRTh8NxBsgbvQkqhaJVkd9`, READY.
- CI #447: 915 tests/161 files, TypeScript, ESLint and Next.js build passed.
- Preview deployment requires Vercel SSO. Both write endpoints **return 403 on Vercel Preview** regardless of configured database. This is deliberate to protect production.
- No migration has been run against `lxsvjzbiuewgwpajqrwr` as part of this work.

## Release blockers
- Confirm final catalog branch CI (types, lint, SQL tests, handler tests, build) and reviewed diff.
- Run fully isolated hosted Vercel-to-Supabase integration smoke with a dedicated **nonproduction** Supabase project, or explicitly record the limitation before accepting operational risk. Existing `Samosell-QA` must not be used by default.
- Verify expected `x-vercel-forwarded-for` edge identity for requests arriving at Vercel production. Missing/malformed header fails closed.
- Review browser consent semantics, 35-day raw event retention, purge schedule and the baseline for older `views_count`. Existing `views_count` is historically incomplete. Do not reset or blend older values without labeling a new start date.
- Design and approve a controlled production smoke using a dedicated test listing, consenting two browser identities and a known test account (owner self-view must not count).
- Evaluate false-positive traffic suppression for shared NAT networks: per network 60 detail requests/minute, 30 per listing/day, 240 catalog event impressions/clicks/minute.
- Verify no Supabase update trigger resets `views_count` when service_role updates it.

## Deploy order (requires explicit approval)
1. Back up relevant schema/data and confirm current main production commit and project refs.
2. Run SQL migration **first**, with schema changes reviewed in transaction. Verify private RLS, service_role grants, RPC signatures, and absence of public permissions.
3. Deploy only reviewed main commit after CI, ideally staged production without domain assignment.
4. Test staged deployment against production with **dedicated controlled test listing** only, verify errors, cookie consent, detail counts, catalog exposure/click counts and deduplication.
5. Promote staged production deployment; watch Vercel runtime errors, Supabase IO and event growth.
6. Retain the last stable deployment reference; rollback the application if errors arise. Leave additive analytics tables in place while investigating, rather than dropping them mid-incident.

## Post-release validation (read-only metrics)
- `select count(*) from public.listing_view_daily;`
- `select event_kind, count(*) from public.catalog_engagement_events group by event_kind;`
- `select count(*) from public.catalog_engagement_rate_windows;`
- `select listing_id, event_kind, count(*) from public.catalog_engagement_events where occurred_at > now() - interval '1 day' group by 1,2 order by 3 desc limit 20;`
- Confirm metric values reflect only users who granted analytics consent.
- No query may read or display raw network data: only keyed hashes are persisted.

## Analytics definitions
- **Catalog impression**: at least 50% of an item card intersected the actual viewport for 800 ms while tab is visible and analytics consent granted.
- **Catalog click**: click on the product card's primary listing link; clicking Favorite is explicitly excluded.
- Both are deduplicated per client page instance, listing and event kind on the server using keyed digests. A refreshed page creates a new page instance.
- **CTR** = catalog primary-card clicks / catalog viewport impressions, same date range, with visibility event tracking caveats.
- **Listing view**: consented unique signed-browser or user detail-page view per UTC day, excluding logged-in seller and known crawler UAs. This is intentionally different from page_view (which can count multiple visits).

## Privacy, operational scope and rollback
- No raw IP or user-agent is persisted in measurement tables.
- Do not infer verified unique people from these metrics; cookie deletion, shared-network rate caps, user consent and bot spoofing limit accuracy.
- Event data retention policy: 35 days, rate windows 2 days. Purge function for catalog supplied but requires separate maintenance activation. Listing detail deduplication also needs approved housekeeping.
- Browser denial/consent withdrawal prevents new events; stored aggregate counts remain historical.
- Both features are additive and must not interfere with catalog rendering or listing access if analytics endpoint fails (fire-and-forget).
- Preview endpoint writes are blocked to ensure connected production data is safe.
