# Growth Tracking v1 — integration and release guide

Branch: `preview/growth-analytics-20261007`. Never apply a migration, merge `main`,
change Production credentials, or promote this Preview without the owner's separate approval.

## Audit

- Existing: optional GA (`NEXT_PUBLIC_GA_MEASUREMENT_ID`) and Plausible
  (`NEXT_PUBLIC_PLAUSIBLE_DOMAIN`), TOP.ge, Speed Insights, first-party CWV,
  search impressions/interactions/experiments, ad impressions/clicks, payment audit records.
  These retain their existing purposes and are not duplicated into Growth.
- Consent v1: necessary/personalization/analytics, 180-day choice expiry.
  Marketing is now an independent opt-in, default false for old choices. It requires
  analytics permission; withdrawing analytics also disables marketing.
- Missing before this branch: acquisition IDs, persisted UTMs, registration/seller/payment
  conversion stream, Meta adapter, linked growth funnel, Growth dashboard, `/sell`.
- Schema inspection was read-only on `lxsvjzbiuewgwpajqrwr`; no existing generic table fit.
- `Samosell-QA` (`ydocqjdjmffysexkzxyc`) exists but is INACTIVE; an active isolated
  Preview database has not been confirmed. It was not resumed, altered or used.

## Event contract

| Event | Authority | Deduplication |
|---|---|---|
| page_view | Consented browser + server ingestion | One ID per route/query navigation; retries reuse it; refresh is a new page view |
| registration_completed | Auth database trigger on initial email confirmation; Google confirmed insertion | `registration_completed:<user UUID>`; no historical backfill |
| listing_started | Actual file selection / field change in creation wizard | Attempt UUID in consented sessionStorage, retained across refresh, cleared on successful save |
| listing_published | Server hook after all listing/media saves succeed; SQL verifies owner, active state and media | `listing_published:<listing UUID>` |
| listing_edit_completed | Server after successful edit | Stable request UUID reused on retry |
| listing_publish_failed | Consented client failure path | One ID per failed attempt; never counts as publish |
| boost_checkout_started | Server after checkout is created and before redirect; SQL reads real order | Product kind + order UUID; sandbox excluded |
| boost_purchase_completed | Database trigger on independently verified successful order state | Product kind + order UUID; permanent minimal conversion key |

Registration, publication and purchase are operational outcomes, recorded without optional
visitor IDs if analytics was denied. Starts and publish failure diagnostics are optional
analytics. Browser ingestion cannot forge registration/publication/purchase, user IDs,
amounts or trusted provider states. No marketing is sent without explicit permission.

Purchase covers VIP, TOP, VIP MAX/combo and self-service banners. TBC requires
`Succeeded`, a provider payment ID and `paid_at`; Flitt additionally requires a matching
live attempt, matching seller/amount/currency/payment ID, approved provider state and
`status_api` independent verification. Failed, cancelled, pending, test and reversed
states cannot create a purchase. Later refunds do not rewrite historical receipts:
**revenue is gross successful receipts, not net revenue**. Sandbox events never
inflate live revenue. Existing payment state machines, configurations and callbacks remain
responsible for payment verification; Growth adds no provider calls to them.

## Schema and security

Migration: `supabase/migrations/20261007090317_growth_tracking_v1.sql`.
Created by the CLI, filled locally; not applied to any remote project.

Tables: `growth_events`, `growth_user_context`, `growth_order_context`,
`growth_conversion_keys`, `growth_consent_state`.
RLS enabled; PUBLIC/anon/authenticated grants revoked. Service-only RPCs use
SECURITY INVOKER. Two private SECURITY DEFINER trigger functions have an empty
search_path, qualified objects and revoked public execute; they have no exposed RPC.
Admin summary additionally checks the trusted `profiles.is_admin` field.

Indexes cover time/name, actor/time, visitor/time, listing and a partial Meta outbox.
Summary is aggregated server-side in a bounded 31-day RPC; raw event rows are never
sent to the admin browser. Browser ingestion is capped at 120 events/visitor/10 minutes,
serialized with an advisory lock. This is not a substitute for edge/IP abuse controls;
random-ID abuse should be covered by the platform rate policy at larger traffic volumes.

Raw browser events: 90 days; operational events: 365 days; visitor attribution:
30 days; idle session timeout: 30 minutes. `prune_growth_events(5000)` is a bounded
service-only maintenance function. **Scheduling pruning is a release task:** no cron or
Production configuration has been changed. Minimal conversion keys remain to prevent
late callback replay after raw retention. No email/password/token/card/secret/IP is stored.
UTM labels are allowlisted and bounded; referrer stores origin only; path omits query,
fragment, listing slugs, user/chat identifiers. Marketing payload external IDs are SHA-256.

First/last touch persist through same-browser navigation, login, email confirmation and
checkout. Attribution across another browser/device or after denied consent is unavailable;
no fingerprinting or auth metadata abuse is used to invent it. Loss of optional telemetry
never makes a successful business action fail. Browser events can be lost to blockers or
network failure; server listing hooks log ingestion failures. Auth/purchase trigger events
are committed alongside the authoritative transaction.

## Dashboard definitions

`/admin/growth?period=today|7|30`, authorized by existing admin layout and page guard.
Calendar periods start at midnight Asia/Tbilisi and end at query time.

Traffic is consented **browser visitors**, not deduplicated humans across devices. The
funnel follows one visitor cohort through linked accounts and chronological stages inside
one selected period; returning existing sellers' activity is separately displayed above it.
Each stage counts unique cohort browser IDs; it cannot exceed the previous stage.
Registration-to-published activity conversion intersects registrations in the selected period
with subsequent published listings. Listing-to-boost intersects the selected period's
published listing IDs with their later successful listing boost purchases. Banners contribute
to receipts/AOV/paying sellers, but not to the listing funnel.

New seller: first observed publication with no earlier Growth publication or earlier extant
listing. Deleted pre-tracking listings are not reconstructable; this is an observed-history
metric. Listings per seller uses all unique publishing sellers in the period. Favorites added
and chats initiated use existing timestamped rows; deleted favorites/threads cannot be
reconstructed. Listing view totals are omitted because the existing lifetime counter cannot
reliably answer period-specific views. Source/campaign show top 30 first-touch groups;
first/last conversion attribution is stored for future richer reporting.

Missing schema/disabled tracking displays an unavailable state, not fabricated zeros.
Ad spend remains `Meta Ads spend data not connected`; CAC/ROAS and cost-per metrics
have no invented numbers.

## Environment variables

| Variable | Purpose / setting |
|---|---|
| GROWTH_TRACKING_ENABLED | `true` only after migration and backend verification; review Preview is `false` |
| NEXT_PUBLIC_PREVIEW_READ_ONLY | Review-only Preview `true`; blocks site POST/auth callback exchanges and Supabase write transports; never enable in Production |
| PREVIEW_GROWTH_DATABASE_REF | Required to allow Growth writes on Preview; must match its Supabase URL and differ from Production |
| NEXT_PUBLIC_META_PIXEL_ID | Owner's public Pixel / Dataset ID; absent until supplied |
| META_PIXEL_ID | Same ID server-side; mismatch prevents CAPI delivery |
| META_CAPI_ACCESS_TOKEN | Server-only encrypted token, configured directly in Vercel; never paste into chat/source/public variables |
| META_CAPI_ENABLED | `true` only for approved Meta integration; currently false |
| META_GRAPH_API_VERSION | Explicit supported `vNN.0` version, verified when enabling; no guessed hardcoded default |
| META_TEST_EVENT_CODE | Optional Events Manager test code; mandatory for Preview CAPI delivery |
| SITE_URL | Existing canonical event source origin; HTTPS Production origin after release |
| NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Existing public backend configuration; isolated values for mutation QA |
| SUPABASE_SERVICE_ROLE_KEY | Existing server-only credential for the SAME backend; never copy a Production key into mutation QA |

Missing from owner: correct SamoSell Dataset/Pixel ID, CAPI token configured securely,
and optional test event code. Confirm the Dataset belongs to SamoSell. This branch does not link accounts, enable ads or spend money.

## Meta readiness and reliability

Mappings: PageView, CompleteRegistration, StartListing (custom), PublishListing (custom),
InitiateCheckout, Purchase. Browser eventID equals server event_id. Purchase carries
value, GEL and product/order identifiers. Browser Pixel is dynamically loaded after explicit
marketing consent; no blocking head script. CAPI runs after response through Next `after`,
using a persistent claim/lease outbox and the same ID on retries. Callback and ordinary
consented traffic trigger delivery; idle outbox retries require a future approved maintenance
job. Preview cannot deliver CAPI without its test event code and isolated database gate.
Marketing withdrawal updates user/order/outbox permission and anonymous consent state;
stale in-flight ingestion cannot overwrite a newer anonymous withdrawal.

External-ID-only CAPI payloads prioritize minimal data: match quality must be assessed in
Meta Test Events before enabling campaign optimization. Credentials do not establish
spend reporting; Meta Ads spend API connection is separate future work.

## Review Preview

This branch's Preview reads only the already-public catalog from Production. It has no
active Growth collector or checkout. Login/account creation/listing mutations are blocked
both at the Next proxy and Supabase transport. This avoids accidental production writes
when following `/sell` CTA. Auth links preserve `/dashboard/listings/new`, but cannot
complete real login on this review deployment. The dashboard remains admin-only;
public visitors cannot access a demo copy containing fabricated metrics.

## Release gate

Before activation: obtain an active isolated Preview backend, verify all keys point to it,
apply the migration there, run real Google/email/listing/sandbox checkout flows, verify
callback/retry consistency, then review the complete data-backed dashboard. Supply Meta
credentials securely and verify deduplication in Events Manager separately. Production
schema application, enabling Growth, merge and deployment each await owner approval.

No production merge, deployment, schema/data/config mutation, live payment, secret edit,
or external messaging was performed during this task.
