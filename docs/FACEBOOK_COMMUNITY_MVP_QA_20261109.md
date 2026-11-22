# Facebook Community MVP — audit and QA

Date: 2026-11-09 (Asia/Tbilisi)

## Scope and architecture

- Base: `origin/main` at `b4687f8`; isolated branch `codex/facebook-community-mvp-20261109`.
- Inspected remote branches and all 18 open PRs. Earlier sharing branches (`feature/listing-social-share-20260928`, `fix/listing-share-icons-visible`, `fix/instagram-story-direct-share`) already have their functionality in main. Reused that implementation; did not duplicate it or pull in unrelated open PRs.
- Listing detail: `app/listing/[slug]/page.tsx` → `ListingOverviewCard` → existing `ListingSocialShare`. Public canonical URLs come from `absoluteUrl`, fixed to `https://samosell.ge` independently of Preview host and attribution parameters.
- Listing cards: `CatalogListingCard` → `MarketplaceProductCard` → detail link. Kept that navigation and existing card layout; the community actions live on the detail page, avoiding extra requests per catalog card.
- Settings: `/admin/system`, using `requireAdminUser` and the caller's authenticated Supabase client. Added one public non-secret destination in a new singleton `community_settings` table. No existing generic editable application-settings table was found.
- Analytics: existing consent → `/api/growth/events` → service-only `ingest_growth_browser_event` → `growth_events`; the admin Growth page displays aggregate action counts for the selected period.
- SEO: existing `generateListingMetadata` already emits listing-specific title, description, canonical, Open Graph URL/image/description and Twitter large-image card, with a public image fallback. Added regression coverage; no competing metadata implementation.

## Behavior

- The existing Facebook sharer opens a normal external link using the public listing URL. No SDK, Meta token, App ID, Groups API, automatic publishing or permission request is added.
- The fallback is always available because SamoSell cannot inspect Facebook's cross-origin destination choices: copy ready-to-paste Georgian post, copy bare listing link, open configured group.
- Copy failure exposes selectable read-only text for manual copying. Copy success is reported only after the Clipboard API resolves.
- External links use `target=_blank` and `rel=noopener noreferrer`. Actions remain keyboard accessible and use wrapping controls with at least 44px height.
- Settings accept direct HTTPS Facebook group URLs, normalize supported desktop/mobile Facebook hosts, strip tracking parameters, and reject profiles, posts, redirectors, credentials, control characters and lookalike hosts. Database validation independently constrains the stored canonical format.
- Only active public listings show community sharing controls. Private/non-public listing IDs cannot be ingested as share events.
- The owner confirmed that no Facebook group exists yet. The default is NULL; no real or invented destination is seeded. Group creation is a future task. Synthetic URLs exist only in disposable automated tests.
- First-party events are `listing_share_action` with a bounded `share_action`: `facebook_share_clicked`, `post_copied`, `link_copied`, `group_open_clicked`. Clicks indicate intent, not confirmed dialog opening, group access, moderation approval or publishing. A copied post is not a Facebook post.
- Analytics needs consent, uses sanitized paths, does not store copied text/URLs, uses the existing 120 events/visitor/10-minute limit and event-ID deduplication. Sharing events never become Meta conversions and do not overwrite the visitor's marketing preference.

## Database and safety

One migration: `supabase/migrations/20261109110707_facebook_community_sharing.sql`, generated with `supabase migration new`. No duplicate setting or migration was found. It creates the singleton and policies, extends the existing growth event constraint and ingestion function, and adds a service-only admin aggregate RPC.

- RLS enabled; anonymous/authenticated users may read the public destination.
- Only authenticated administrators can update `facebook_group_url`; neither role may insert, delete, replace the singleton or write unrelated columns.
- Existing growth tables and RPCs remain service-only. The aggregate RPC separately verifies the admin actor and a bounded period.
- Preview/local setting writes reject the Production database hostname, including trailing-slash/query variants. The exact review branch is additionally pinned to existing public Production reads with `NEXT_PUBLIC_PREVIEW_READ_ONLY=true`; the existing proxy blocks admin, authenticated and API routes entirely. Supabase mutations and optional growth telemetry are also blocked.
- Group read failures/missing migration degrade to copy-only UI; they do not fail the listing page. Public settings reads use a 60-second cache and a 3-second timeout; successful admin saves invalidate that cache.
- No dependencies, paid services, polling, cron jobs, Production settings, Production migrations or Production deployments added.
- Connected `Samosell-QA` was inspected read-only; the new table does not exist there. No remote migration was applied to QA or Production.

## Automated verification

| Check | Result | Evidence / limits |
| --- | --- | --- |
| TypeScript | PASS | `pnpm exec tsc --noEmit`, including a final run after the settings guard test was added |
| Lint | PASS with existing warnings | `pnpm lint`: 0 errors, 8 pre-existing `no-img-element` warnings in unchanged files |
| Full tests | PASS | `pnpm test`: 224 files, 1,402 tests passed |
| Focused settings/client/SEO checks | PASS | 33 tests passed, including the added settings-server tests |
| Real SQL / RLS behavior locally | PASS | `GrowthDatabase.test.ts`: 24 tests, actual disposable PostgreSQL engine (PGlite), not a mocked SQL response |
| Optimized build | PASS | `node scripts/build-with-public-fixture.mjs`: compiled, type checked and generated all 53 static pages using the existing local public-data fixture |
| Production writes | NONE | Remote database inspection was QA-only and read-only; build used a local fixture |

Database tests cover anonymous reads, denied anonymous writes, denied non-admin updates, allowed admin update/clear, singleton insert/delete denial, invalid URL constraints, aggregate access control, active-listing validation, rate limits, deduplication, retained marketing preferences and exclusion from Meta delivery.

Component/API tests cover canonical external links, configured/unconfigured destination, Georgian post and link copying, Clipboard denial/manual text, no false published state, analytics consent, no telemetry in read-only Preview, invalid input, cross-origin requests and body limits. Existing private-listing, metadata and growth/payment tests also pass.

Local runtime is Node 24.14.1; the project specifies Node 22.x. The existing Vercel project setting is Node 24.x, left unchanged. GitHub CI independently passed TypeScript, lint, all **1,409 tests in 225 files** (including the final settings-server tests), and the fixture build on Node 22. [CI run](https://github.com/bulbula93/samosell-lunching2/actions/runs/42608174276).

## Preview and release assessment

[Draft PR #164](https://github.com/bulbula93/samosell-lunching2/pull/164).

[Preview](https://samosell-lunching2-3hlkp8ep5-giorgibulbula-6265s-projects.vercel.app/listing/zara-dbfe42c8), deployment `dpl_CaJaTZtxotxFzg29ohpBUEosBfpL`, application commit `5ee272bc6c0e8c96b303a57d194261bdbe2d20cc`. Vercel state **READY**, target **null (Preview)**; no Production aliases promoted. Subsequent QA-report-only commits do not change the tested application.

| Preview scenario | Result | Evidence / limits |
| --- | --- | --- |
| Home card → active listing | PASS | Opened a real listing through its homepage card in Chrome; listing content and new community region rendered |
| Unconfigured group | PASS (render) | Both copy controls and explicit unconfigured message rendered; no invented group destination |
| Canonical / Open Graph / Twitter | PASS | Authenticated Vercel HTTP fetch returned 200; canonical and `og:url` are `https://samosell.ge/listing/zara-dbfe42c8`; title, size/condition/city description and image are listing-specific |
| Images | PASS | Actual public `og:image`: HTTP 200 `image/webp`; public fallback: HTTP 200 `image/png` |
| Missing listing | PASS | HTTP 404 with listing-not-found title and noindex |
| Preview indexing / caching | PASS | `x-robots-tag: noindex`; listing response private/no-store; security headers retained |
| Admin route isolation | PASS | Authenticated Vercel HTTP fetch of `/admin/system`: HTTP 403 `preview_read_only`, as required by the existing proxy |
| API route isolation | PASS | Authenticated Vercel HTTP fetch of `/api/growth/events`: HTTP 403 `preview_read_only`; the Preview cannot reach ingestion |
| Copy buttons / actual Clipboard | BLOCKED | Chrome automation reported another extension UI on the page; retry after the owner closed the site still failed. Native accessibility inspection found an injected `chrome-extension://.../html/iframe_block_page.html`. No extension or security control was disabled; live copy success is not claimed |
| Mobile viewport / visual QA | BLOCKED | The same Chrome extension block rejected viewport control and screenshots. Responsive classes and component tests are verified, but live mobile layout is unverified |
| Authenticated admin save and persisted analytics | NOT RUN | This Preview intentionally blocks admin/API writes and no remote migration was applied. RLS and ingestion were verified in local PostgreSQL, not deployed end-to-end |
| Group selection / opening / posting | NOT RUN | No real group exists. Synthetic configured destinations were tested only in disposable unit/SQL tests |

The in-app browser also timed out during initialization; Chrome was used to verify the actual page render. Browser interaction limitations are independent of application test/build success.

Release verdict: **NOT READY for Production activation** until isolated deployed admin-save/event-persistence QA, live Clipboard and mobile browser QA are complete. No group URL can be activated until the group exists. The implementation, SQL tests, CI and read-only Preview are available for review.

Facebook destination choices, login/membership requirements, administrator approval, actual posting and rendered Facebook link-preview cache are controlled by Meta. No actual Facebook post was created or confirmed by this work.

Reference entrypoints: [Share Dialog](https://developers.facebook.com/docs/sharing/reference/share-dialog/), [Graph API v19 changelog](https://developers.facebook.com/docs/graph-api/changelog/version19.0/), [Sharing for Webmasters](https://developers.facebook.com/docs/sharing/webmasters/), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security). Meta developer documentation returned HTTP 429 during this audit, so current logged-in Facebook group-picker behavior is explicitly unverified; the implementation does not depend on it.

## Activation and rollback

1. Review the PR and validate the migration in isolated QA. Do not apply to Production without the owner's separate approval.
2. Verify real admin save/clear, non-admin denial and consented event ingestion end-to-end in that isolated environment. Then obtain separate approval for any Production migration/release.
3. After the future group is created, an admin can enter its actual URL at `/admin/system`. No Meta token is needed.
4. To disable the group destination, clear the URL; direct Facebook sharing and copying remain available.
5. For application rollback, revert this PR's application commit and redeploy only through the approved release process. The additive table/column and expanded event allowlist may remain; older application code continues to work. Do not drop telemetry or roll back the migration destructively. No rollback action was executed in this task.
