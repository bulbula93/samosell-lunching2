# Growth P0 sale attribution QA — 2026-10-22

Branch: `preview/growth-p0-20261022` · PR: #130

## Verdict: NOT READY

External-sale UI and the seller side of the SamoSell flow passed on the deployed QA Preview. The SamoSell buyer/chat were seeded in QA; an independently signed-in buyer did not perform the message/review-request UI journey. Exact 390px and 1440px runs remain unverified because the available browser has no viewport-resize API (observed viewport: 1363×936). Cleanup is partial: one isolated test buyer and its canceled review notification remain after the connector rejected deletion with `Invalid or expired requestState`; the browser session then ended.

Validated application commit: `5a024f56bc5dba4cf405988239c416dccb0f607b`.
CI #632, run [39761016043](https://github.com/bulbula93/samosell-lunching2/actions/runs/39761016043): SUCCESS.
Validated deployment: https://samosell-lunching2-1vwql16fa-giorgibulbula-6265s-projects.vercel.app
Stable branch URL: https://samosell-lunching2-git-prev-3132e4-giorgibulbula-6265s-projects.vercel.app

## Findings and fixes

1. **Preview used Production Supabase.** Stopped before test mutations. Added branch-only Preview overrides for QA project `ydocqjdjmffysexkzxyc` and its public key. Blanked inherited service-role credentials and outbound Resend email, disabled checkout flags, and enabled QA writes. Production settings/data/secrets/schema were not changed.
2. **Google login redirected to a deleted Preview (410).** Corrected QA Supabase Site URL and allowed callback host to the stable branch URL. Reload verification and Google seller login passed.
3. **Create-listing Continue accidentally published before Preview.** React reused the same button node when its type switched to submit. Added distinct Continue/Publish keys and prevented the navigation click's default action. Regression test failed before the fix and passed afterward. Browser retest showed Preview with zero premature listings, followed by successful explicit Publish.
4. **QA uploaded images were rejected.** Media validation and Next image configuration allowed only the Production storage host. They now also allow the configured HTTPS Supabase project host, validated against a strict project-host pattern, while retaining public-object path restrictions and image optimization settings. Eight regression cases cover QA images and unsafe/private/arbitrary hosts. Deployed image loaded with naturalWidth 210.
5. **Six stale CI assertions across three files.** Updated homepage copy/empty VIP and sold-source payload expectations to intended behavior. Added eight sale-source UI/action regression cases; no tests removed or skipped.

## Results

| Check | Result | Evidence / scope |
| --- | --- | --- |
| Preview database isolation | PASS | Branch-scoped QA URL/key; deployed catalog and test writes matched QA |
| QA migration | PASS | `20261022085227 growth_p0_track_sale_source` applied; live trigger checked |
| Google seller login | PASS | Correct current callback and authenticated dashboard |
| UI listing creation | PASS | Two new listings created through all four wizard steps and explicit Publish |
| External sold fields | PASS | UI submit → status=sold, sold_source=external, sold_to_user_id=null |
| External hidden from active catalog | PASS | Exact-title catalog search returned zero results |
| External review request absent | PASS | Zero review-request notifications |
| External buyer optional | PASS | Submit enabled without a buyer |
| SamoSell missing buyer blocked | PASS | UI submit disabled; database rejects missing buyer |
| SamoSell verified-buyer selection | PASS, seeded buyer setup | Seller UI selected eligible QA buyer; correct buyer/source/status persisted |
| SamoSell review request | PASS, database observation | Exactly one notification for selected buyer after double-click submit |
| Buyer receives/sees request in UI | NOT RUN | No independent buyer browser session |
| Buyer opens listing and sends first message in UI | NOT RUN | Buyer, chat and first message seeded in QA |
| Seller Chat UI | PASS | Opened seeded conversation; sent UI reply; database sender/body verified |
| Foreign user cannot review | PASS, database/RPC | Real authenticated review RPC rejects outsider; no foreign-user browser run |
| Selected buyer may review | PASS, database/RPC | Real authenticated review RPC accepted selected buyer in rollback-only test |
| External sale cannot be reviewed | PASS, database/RPC | Real review RPC rejects external-sale review |
| Other seller cannot change status | PASS, database/RLS | Authenticated non-owner update prevented |
| Repeated submit creates no duplicate notification | PASS | UI double-click + database repeat update; exactly one event |
| Reactivation clears attribution | PASS | Both UI listings returned active with source/buyer null; buyer request canceled |
| TypeScript | PASS | tsc --noEmit |
| ESLint | PASS | 0 errors; 8 existing no-img-element warnings |
| Vitest regression | PASS | 199 files, 1,133 tests |
| Next.js production build | PASS | build-with-public-fixture.mjs, exit 0; no live Production data access |
| Reviews / Chat / Listing regression | PASS, automated | Included in full Vitest run; seller chat/listing UI also exercised |
| Mobile UI, 390px | NOT RUN | No viewport resizing capability in available browser |
| Desktop UI, 1440px | NOT RUN | Observed browser width was 1363px |
| Fixture cleanup | PARTIAL | All three test listing records and uploaded objects removed; details below |

## Database integration evidence

`scripts/qa-sale-attribution.sql` ran on QA only with explicit authenticated actor claims and anonymous catalog visibility checks. All twelve checks passed: missing SamoSell buyer blocked; external buyer blocked; external fields stored; no external request; sold anonymous visibility denied; non-owner update denied; SamoSell fields stored; repeat notification deduplicated; outsider review denied; external review denied; selected-buyer review accepted; reopening clears both fields. The transaction rolled back and its fixtures were verified absent.

No new schema migration was required for the UI fixes. The existing migration was not applied to Production.

## Cleanup evidence and remaining scoped work

The existing signed-in seller account and its original listing were preserved. Only fixtures created during this run were targeted.

Verified absent after normal application deletion, including storage cleanup:

- External listing `9f940924-df01-42f0-9732-c32f2e98f549` and its uploaded image.
- SamoSell listing `b7c05a07-d78d-4a48-aed0-f6da9a85695e` and its uploaded image.
- Failed-upload cleanup draft `5aa6c063-3045-4bfd-b19b-1b8fa8b04b6f` and its orphan image.
- Seeded chat `e2261022-1000-4000-8000-000000000021` and its messages (cascade deletion).

Remaining, ownership confirmed:

- Test-only auth user/profile `e2261022-1000-4000-8000-000000000002`, email `sale-ui-qa-buyer-20261022@example.invalid`. No password or browser session was assigned.
- Canceled request notification `3b0c7096-b1f2-4d58-97b9-1b5c90c46616`, event key `review_request:b7c05a07-d78d-4a48-aed0-f6da9a85695e:e2261022-1000-4000-8000-000000000002`.

Two cleanup attempts returned `McpServerError: Invalid or expired requestState`; readback confirmed these two records still present. Do not interpret the error as successful deletion. The browser session subsequently had no tabs. Complete only this scoped QA cleanup when the connection is restored; never delete the existing seller account.

## Release boundary

PR remains open, draft and unmerged. No Production deployment, data write, secret change or schema migration was performed. READY requires the independent buyer UI journey, exact 390px/1440px checks, and verified completion of the remaining scoped cleanup.

Custom brand creation and other service-role-only capabilities remain unavailable on this isolated QA branch until a QA-specific server credential is configured; ordinary existing-brand listing/sale actions use authenticated QA access.
