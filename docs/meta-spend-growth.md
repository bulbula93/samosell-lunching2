# Meta Ads Spend → Growth

Work branch: `preview/meta-spend-growth-20261007`. Production is untouched.

## Source and account

The implementation reads Meta Marketing API directly, server to server. It does not
read spend from a conversation, accept manual spend, or import Windsor CSV exports.
Windsor's Connectors API is a legitimate alternate backend integration, but requires
its own API key; the ChatGPT connection/selected account does not provide that key.
No Windsor sync is claimed or implemented in this release.

Only account `948841811174019` / `SamoSell Ads` / `USD` / `Asia/Tbilisi` is allowed.
Before each import the API must confirm all four attributes. The old account is
rejected by configuration, source validation and database constraints.

Meta access is read-only (`ads_read`). The user created the Marketing API app
`Samosell Growth` (`3054135721598772`) and securely supplied its token to Vercel.
Prefer a system user token scoped to the approved account for unattended production
sync. The configured token's lifetime still needs verification before cron activation.
Do not reuse CAPI tokens or grant ads management permissions just to read spend.

## Credentials and Preview

Vercel project `samosell-lunching2`, Preview branch-specific variables:

| Variable | Required value |
| --- | --- |
| NEXT_PUBLIC_SUPABASE_URL | `https://ydocqjdjmffysexkzxyc.supabase.co` |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Public key of that same QA project |
| PREVIEW_GROWTH_DATABASE_REF | `ydocqjdjmffysexkzxyc` |
| SUPABASE_SERVICE_ROLE_KEY | Secret server key of **QA**, configured directly in Vercel |
| META_ADS_AD_ACCOUNT_ID | `948841811174019` |
| META_ADS_ACCESS_TOKEN | Secret Meta Marketing API token, configured directly in Vercel |
| META_ADS_GRAPH_API_VERSION | `v26.0`, observed in the official Graph API Explorer on 2026-10-07; revalidate when upgrading |
| META_ADS_APP_SECRET | Optional secret app proof key if the Meta app requires appsecret_proof |
| META_ADS_SPEND_ENABLED | `true` |
| META_ADS_SPEND_CRON_ENABLED | `false` during review |
| GROWTH_TRACKING_ENABLED | `true` after QA Growth schema verification |
| NEXT_PUBLIC_PREVIEW_READ_ONLY | `false` on isolated QA; `true` for a review-only environment |

Branch-specific Meta token and QA server key are configured as sensitive secrets.
Vercel cannot return a sensitive key's plaintext; configure any replacements directly
in Vercel and redeploy this Preview branch. Never send secrets in chat, commit
them, put them in NEXT_PUBLIC variables, or copy a Production service key here.
Checkout and CAPI are disabled on this Preview. Scheduled spend sync is disabled.

## Storage and sync

Migration: `20261007123857_meta_ads_daily_spend.sql`, created using the Supabase CLI.
Applied only to `ydocqjdjmffysexkzxyc`.

`meta_ads_daily_spend`: one account row per date, unique `(ad_account_id,date)`.
Campaign columns are reserved and must remain NULL in v1. No campaign rows are
mixed into account totals, and there is no campaign revenue attribution.
`meta_ads_sync_state`: singleton lease/cooldown and safe last error code.
Both have RLS, revoked PUBLIC/anon/authenticated grants, service_role-only access.
All sync functions use SECURITY INVOKER, an empty search_path and service-only EXECUTE.

Every sync reads the last 30 inclusive Tbilisi calendar days (`time_increment=1`,
`level=account`, explicit since/until). Fixed-host Bearer-header requests never
follow redirects or provider pagination URLs; only an opaque after cursor is reused.
Malformed, duplicate, foreign-account, wrong-currency and partial reports abort.
No rows are written until the complete report is verified. Successful reports
with missing inactive days permit zero-spend rows; failed reports never become zero.

An advisory-locked 120-second lease and 60-second cooldown prevent overlapping
imports. One transactional commit verifies 30 unique consecutive dates and upserts
the complete snapshot; stale lease commits and repeated commits are rejected.
Failed syncs retain prior successful rows and set a safe error code. Dashboard
requires every selected date, displays coverage and snapshot time, and flags
snapshots older than 26 hours. Today's Meta data remains provisional and may lag.

Manual route: `POST /api/admin/growth/meta-spend/sync` — verified auth plus trusted
`profiles.is_admin`; exact same-origin request required. No credentials or spend
amounts are accepted from the browser.
Scheduled route: `GET /api/internal/growth/meta-spend/sync` — explicit cron flag and
timing-safe `CRON_SECRET` validation. No `vercel.json` cron was added or activated.

## Currency and reproducibility

Original USD spend is always retained. NBG official historical endpoint:
`https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?date=YYYY-MM-DD`.
Select USD, divide rate by quantity, validate official validFromDate no later than
the spend date and no more than 7 days earlier. No current-rate fallback is used.
Store rate, rate date, NBG source and converted GEL. Existing successful rates
remain immutable on subsequent upserts; revised Meta USD spend uses that same
snapshot. Missing rates can be filled by a later successful sync.

If any selected date lacks FX, show only USD spend and `FX unavailable`; withhold
the GEL total and all GEL costs/ROAS. Do not show a partial converted sum as a total.

## Financial definitions

Today / 7 / 30 use the existing Growth calendar boundaries and same request time.

- Registration cost = Meta spend GEL / confirmed Growth registrations.
- Published listing cost = Meta spend GEL / published listings.
- New seller cost = Meta spend GEL / observed new sellers.
- Paying seller CAC = Meta spend GEL / unique paying sellers.
- Blended ROAS = confirmed live Growth gross revenue GEL / Meta spend GEL.

Zero denominator → `—`. Reported zero spend with a positive count → zero cost;
zero spend ROAS → `—`. Unavailable Growth or spend/FX → unavailable costs.
Revenue is the existing authoritative Growth RPC; no alternate revenue calculation
is introduced. Test, pending and failed payments are excluded. Gross receipts
are before refunds, and pre-tracking outcomes cannot be reconstructed. This is
account-level blended ROAS, not campaign-attributed ROAS; names are never used
to infer campaign attribution.

## Release gate

The QA Preview completed two real Meta API syncs on 2026-10-07 at 19:16:09 and
19:18:06 Asia/Tbilisi. The validated account reported no spend for 2026-09-08
through 2026-10-07. All 30 unique dates have saved NBG FX. A repeated sync retained
30 rows and identical FX snapshots. Production remains unchanged.

## Graphical dashboard

The daily USD/GEL chart uses those same validated rows in date order. It is an
interactive SVG with currency buttons, day selection, a mobile range control and
an accessible daily table. Missing FX disables GEL; an incomplete spend period
produces no series. Zero reported spend stays a flat zero series.
The funnel uses the original same-cohort counts. Source/campaign bars visualize
visitor counts and shares, never attributed revenue. Cost bars use the same CAC
formulas; null and zero remain distinct. No chart dependency or new database
query/schema is introduced. All charts remain behind the existing admin access.

Before READY: securely configure QA server key and Meta credentials, redeploy
Preview, sign in as a QA administrator, run the real sync, verify API account
metadata and Today/7/30 spend, repeat after cooldown and check row count remains
30, verify FX and live Growth comparison. Current tests use isolated local
fixtures only; no fake/demo spend was written to QA or Production.

Production approval remains necessary for migration, Production secret/flag
configuration, main merge and Production deployment. After approved release,
run a first real sync and verify metrics before enabling a daily cron. On Hobby,
prepare a daily schedule (for example `0 1 * * *`, 05:00 Tbilisi) rather than
assuming hourly cron support. Keep cron disabled until separately approved.
