# Growth Tracking v1

Branch: `preview/growth-analytics-20261007`  
Repository: `bulbula93/samosell-lunching2`  
Review date: 2026-10-07

## Implemented

- ცენტრალიზებული browser/server/database event layer; არსებული GA/Plausible, search, ad და CWV telemetry შენარჩუნებულია და მათი მოვლენები Growth-ში არ დუბლირდება.
- `page_view`: consented anonymous/session IDs, trusted authenticated user ID, sanitized path/route group, referrer origin, ყველა მოთხოვნილი UTM, device class, server timestamp.
- Google/email რეგისტრაცია ითვლება მხოლოდ Auth-ის დადასტურებულ მდგომარეობაზე; refresh/retry არ ქმნის მეორე conversion-ს.
- რეალური form/file interaction ქმნის `listing_started`-ს. Successful publish/edit სერვერზე მოწმდება; failed publish ვერ ქმნის publication-ს.
- Checkout და purchase მოიცავს VIP/TOP/VIP MAX და banner-ს. Revenue authoritative database outcome-დან მოდის. Failed/pending/cancelled/test payments გამორიცხულია.
- Consent-aware first/last-touch attribution ინახება 30 დღით და ნავიგაციის/auth/checkout შემდეგ გრძელდება იმავე ბრაუზერში.
- ცალკე marketing opt-in, default false ძველი consent-ისთვის; withdrawal და stale-request დაცვა.

## Database

Migration: [`supabase/migrations/20261007090317_growth_tracking_v1.sql`](../supabase/migrations/20261007090317_growth_tracking_v1.sql).

`growth_events`, `growth_user_context`, `growth_order_context`, `growth_conversion_keys`, `growth_consent_state`; RLS, service-only grants/RPCs, private Auth/payment triggers, indexes, Meta outbox lease და permanent minimal dedup keys.

Migration მხოლოდ branch-შია მომზადებული. არც Production-ზე და არც სხვა remote database-ზე არ applied. SQL mutation tests მხოლოდ ადგილობრივ PGlite-ში შესრულდა.

Retention: browser 90 დღე, operational 365 დღე, attribution 30 დღე. Bounded pruning function მზადაა; maintenance schedule activation release-ის ეტაპზეა.

Production: `lxsvjzbiuewgwpajqrwr`. არსებული `Samosell-QA` (`ydocqjdjmffysexkzxyc`) INACTIVE-ია. აქტიური იზოლირებული Preview backend არ დადასტურებულა და არ ჩამირთავს.

## Meta readiness

| Growth | Meta |
|---|---|
| page_view | PageView |
| registration_completed | CompleteRegistration |
| listing_started | StartListing (custom) |
| listing_published | PublishListing (custom) |
| boost_checkout_started | InitiateCheckout |
| boost_purchase_completed | Purchase |

Browser `eventID` = server `event_id`; Purchase გადასცემს value, GEL და product/order identifiers-ს. Pixel იტვირთება async/lazy მხოლოდ marketing consent-ის შემდეგ. CAPI იყენებს durable outbox-ს, lease-ს და retry-ზე იმავე ID-ს. ამ Preview-ზე Meta გამორთულია.

## Missing Meta credentials

- SamoSell Pixel / Dataset ID → `NEXT_PUBLIC_META_PIXEL_ID` და იგივე `META_PIXEL_ID`.
- Server-only CAPI token → `META_CAPI_ACCESS_TOKEN`; უსაფრთხოდ ჩაიწეროს Vercel-ში, არა source/chat-ში.
- Test Events code → `META_TEST_EVENT_CODE` (Preview-სთვის სავალდებულო).
- Activation-ზე გადასამოწმებელი supported API version → `META_GRAPH_API_VERSION`.
- `META_CAPI_ENABLED=true` მხოლოდ integration verification-ის შემდეგ.

Growth/Preview-ის ყველა საჭირო env და release ნაბიჯი აღწერილია [integration guide-ში](growth-tracking-v1.md#environment-variables). Meta Ads spend API ცალკე მომავალი ინტეგრაციაა.

## Dashboard

`/admin/growth?period=today|7|30`, არსებული admin authorization-ით, თბილისის კალენდარული პერიოდებით.

მომზადებულია: unique consented browser visitors, sessions/page views, source/campaign breakdown, registrations, chronological cohort funnel/conversion/drop-off, listing starts/publications, registered publishers, new sellers, listings per seller, favorites/chats initiated, paid purchases, gross GEL receipts, listing-to-boost, revenue per paying seller, average order value.

Revenue gross receipts-ია, refund-ის გამოკლებამდე. Banners receipts-ში შედის, listing funnel-ში არა. Listing views-ის lifetime counter-ს period metric-ად არ ვიყენებთ.

Tracking/schema unavailable state ნულებს არ იგონებს. Spend: **Meta Ads spend data not connected**. CAC/ROAS არ აჩვენებს გამოგონილ მონაცემებს. Review Preview-ზე live dashboard მონაცემები მიუწვდომელია.

## /sell

არსებულ design system-ში დამატებულია მოთხოვნილი Georgian hero, CTA „დადე პირველი ნივთი“ და სამი მოკლე ნაბიჯი. CTA მიდის `/dashboard/listings/new`-ზე; logged-out login/register ბმულები `next`-ს ინარჩუნებს. არსებული გამართული ფოტო optimized Next/Image-ით იტვირთება. Header streaming boundary იცავს landing-ის ჩატვირთვას მონაცემების მოლოდინისგან.

## QA

| Check | Result |
|---|---|
| New Growth tests | 50 / 50 passed |
| Final focused tests incl. catalog read workload | 53 / 53 passed |
| Full regression | 768 passed / 13 failed (781 total) |
| Same baseline main suite | 718 passed / same 13 failed (731 total) |
| TypeScript / changed-code ESLint | Passed |
| Full ESLint | Existing 2 errors / 11 warnings, same as baseline |
| Optimized Next build | Passed |
| Mobile 390×844 / desktop 1440×1000 | Verified in local production build |
| Anonymous admin access | Redirects to login; SQL/RPC authorization tests passed |
| Preview POST / external OAuth mutation | 403 / OAuth blocked before authorization |

New tests მოიცავს conversion-key lookup privacy დაცვას, external OAuth Preview guard-ს, anonymous/authenticated ingestion, trusted user identity, Google/email confirmation, real listing interaction, successful/failed publication, verified checkout/purchase, pending/failed/test payment exclusion, duplicated callback, retry/refresh deduplication, accepted/denied/revoked consent, UTM persistence და admin/RLS isolation.

13 pre-existing failures: category/draft fixtures, chat loading labels, listing overview expectation, homepage read-budget expectation და missing listing-action mocks. ახალი regression failure არ დაფიქსირდა. მათი დეტალური remediation ამ branch-ის functional scope-ში არ შესრულებულა.

რეალური remote Google/email/signup/listing/payment callback E2E **არ შესრულებულა**, რადგან აქტიური იზოლირებული backend არ დადასტურებულა. Live payment და Production mutation QA არ შესრულებულა.

## Performance

Local Chromium, production build, unthrottled, necessary-only consent; ეს lab samples-ია და არა field percentiles.

| /sell viewport | LCP | CLS | JS errors / overflow |
|---|---|---|---|
| 390×844 | 704 ms | 0.000 | None / none |
| 1440×1000 | 408 ms | 0.054 | None / none |

Homepage decoded JS-ის საწყისი baseline comparison: დაახლოებით +7.8 KB (~0.9%); dependencies/lockfile უცვლელია. Marketplace-ის ზოგად LCP/CLS samples-ში upstream image timeouts და არსებული streaming shifts ჩანს; site-wide no-regression certification ამ ცვალებადი ნიმუშებიდან ვერ გაიცემა. /sell-ის footer shift loading skeleton-ით გამოსწორდა. Admin dashboard-ის responsive layout ადგილობრივ fixture-ზე შემოწმდა — რეალური მონაცემების დემო route არ შექმნილა.
 Blocking third-party scripts: none. Pixel-ის chunk/სკრიპტი consent-მდე არ იტვირთება. Field INP და მოწყობილობებზე aggregate Core Web Vitals ამ ლაბორატორიული შემოწმებით არ დასტურდება.

## Preview

[Review Preview /sell](https://samosell-lunching2-git-prev-5ae3d0-giorgibulbula-6265s-projects.vercel.app/sell)

Vercel Authentication დაცვა შენარჩუნებულია. Preview read-only-ა: public catalog GET-ით იკითხება, site/Supabase mutations, OAuth-ის დაწყება და auth code exchange დაბლოკილია; collector/payments/Meta გამორთულია. UI review შესაძლებელია, რეალური signup/publish/payment QA — ჯერ არა.

## Production Readiness

**NOT READY**

რეალური blockers:

1. აქტიური იზოლირებული Preview backend-ის და migration-ის remote compatibility / რეალური auth-listing-payment-dashboard E2E verification-ის არარსებობა.
2. სრული regression/lint gates ჯერ green არ არის: baseline-ის იგივე 13 test failure და 2 lint error რჩება.

Production main არ merge-ებულა; Production deployment, Supabase schema/data/config mutation, secrets ან payment configuration ცვლილება არ შესრულებულა. Production გაშვება საჭიროებს owner-ის ცალკე დასტურს.
