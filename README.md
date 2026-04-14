# SamoSell

Fashion-first marketplace built with Next.js App Router and Supabase.

## What is already implemented

- public home page and catalog
- listing detail pages with share metadata
- favorites
- seller profiles
- buyer/seller chat
- report & moderation flow
- admin boosts panel
- manual + TBC Checkout boost payment flow
- sitemap, robots, privacy, terms and support pages

## Stack

- Next.js 16
- React 19
- TypeScript
- Supabase SSR auth + database
- Tailwind CSS 4

## Required environment variables

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SITE_URL=http://localhost:3000
```

Optional support metadata:

```bash
SUPPORT_EMAIL=support@samosell.ge
TRUST_EMAIL=trust@samosell.ge
SUPPORT_RESPONSE_TIME=24–48 საათი
SUPPORT_BUSINESS_HOURS=ორშ–პარ, 11:00–19:00
```

Optional manual boost payment metadata:

```bash
BOOST_BANK_NAME=TBC Bank
BOOST_ACCOUNT_HOLDER=SamoSell LLC
BOOST_BANK_ACCOUNT=GE00TB0000000000000000
BOOST_EXTERNAL_PAYMENT_URL=
BOOST_PAYMENT_NOTE=Boost მოთხოვნის შექმნის შემდეგ გამოიყენე payment reference გადარიცხვის დანიშნულებაში.
BOOST_PAYMENT_PROOF_HINT=თუ დაგვჭირდება დამატებითი გადამოწმება, მოგვწერე support-ზე შენი reference-ით.
BOOST_ADMIN_APPROVAL_TIME=24 საათი
BOOST_PAYMENT_CONTACT_EMAIL=billing@samosell.ge
```

Required for TBC Checkout callback/status sync:

```bash
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

Optional, but required if you want direct TBC card checkout for boosts:

```bash
TBC_API_KEY=your_tbc_developers_api_key
TBC_CLIENT_ID=your_tbc_client_id
TBC_CLIENT_SECRET=your_tbc_client_secret
```

## Local development

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Database

Supabase SQL migrations are in `/supabase` and should be applied in order:

1. `01_categories.sql`
2. `02_marketplace_schema.sql`
3. `03_listing_media_public_pages.sql`
4. `04_phase_a_fixes.sql`
5. `05_chat_phase.sql`
6. `06_favorites_phase.sql`
7. `07_moderation_phase.sql`
8. `08_pagination_seo_polish.sql`
9. `09_chat_archive_polish.sql`
10. `10_vip_boosts_phase.sql`
11. `11_trust_conversion_hardening.sql`
12. `12_tbc_checkout_integration.sql`
13. `13_profiles_seller_type.sql`
14. `14_profile_avatars_storage.sql`
15. `15_store_branding_assets.sql`
16. `16_store_profile_details.sql`
17. `17_store_contact_channels.sql`
18. `18_boost_payment_automation.sql`
19. `19_chat_hotfix.sql` *(run this if chat is already broken in an older database and you need a safe one-shot repair)*

## Deploy checklist

### Chat hotfix

თუ ჩათების გვერდზე ხედავ შეცდომებს `chat_threads`, `buyer_last_read_at`, `seller_last_read_at`, `buyer_archived_at` ან `seller_archived_at` შესახებ, გაუშვი `supabase/19_chat_hotfix.sql`. ეს ერთჯერადი repair script უსაფრთხოდ ამატებს საჭირო ველებს, trigger-ს, view-ს და Realtime publication-ს.

### Vercel / hosting

- set `NEXT_PUBLIC_SITE_URL` and `SITE_URL` to the final production domain
- add all Supabase env vars to the hosting dashboard
- add support and boost payment env vars so `/contact`, `/dashboard/billing` and `/dashboard/listings/[id]/promote` show real data
- verify preview and production environments both use the correct Supabase project

### Supabase

- apply all SQL files in order
- verify RLS on `profiles`, `listings`, `favorites`, `chats`, `reports` and `listing_boost_orders`
- verify public storage / listing image bucket behavior
- create at least one admin profile in `profiles.is_admin`

### TBC Checkout / boost payments

- fill real bank account and billing support env vars if you still want a manual fallback
- set `SUPABASE_SERVICE_ROLE_KEY`, `TBC_API_KEY`, `TBC_CLIENT_ID`, `TBC_CLIENT_SECRET`
- in the TBC merchant dashboard set callback URL to `/api/tbc/checkout/callback`
- add your production site URL to `NEXT_PUBLIC_SITE_URL` / `SITE_URL`
- create one test boost request with `TBC Checkout`, complete the card payment, then verify order status in `/dashboard/billing`
- verify successful payments activate the boost automatically after successful TBC sync
- verify the listing receives `vip_until`, `promoted_until` and/or `featured_until` correctly after activation

### Final QA

- register → create listing → publish → open listing page
- favorite / unfavorite
- chat buyer ↔ seller
- report listing → review in moderation
- boost request → admin activate → verify homepage/catalog visibility
- check robots, sitemap, Open Graph preview and canonical URLs on production domain

## Current gateway status

The project now supports TBC Checkout for boost orders while preserving the existing order/admin moderation structure.

## Analytics და error monitoring მომზადება

საიტში უკვე ჩასმულია საწყისი კლიენტური ინსტრუმენტაცია:

- `NEXT_PUBLIC_GA_MEASUREMENT_ID` — თუ მიუთითებ, ჩაირთვება Google Analytics page view tracking
- `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` — თუ მიუთითებ, ჩაირთვება Plausible script
- `MONITORING_LOG_ENABLED=1` — სერვერზე უფრო დეტალური მონიტორინგის ლოგებს დაბეჭდავს

კლიენტური unhandled error-ები იგზავნება `/api/monitoring/client-error` endpoint-ზე, რაც კარგ საწყის წერტილს იძლევა სანამ სრულ Sentry/Logtail/Datadog ინტეგრაციაზე გადახვალ.

## ახალი migration

`supabase/13_profiles_seller_type.sql` ამატებს პროფილში `seller_type` ველს (`individual` / `store`). გაუშვი ეს migration სანამ ახალი პროფილის ველი გამოიყენება.

`supabase/14_profile_avatars_storage.sql` ქმნის `avatars` storage bucket-ს და policy-ებს, რომ მომხმარებელმა საკუთარი ავატარი ატვირთოს. ეს migration გაუშვი სანამ პროფილში ფოტოს ატვირთვას გამოიყენებ.

`supabase/15_store_branding_assets.sql` ამატებს პროფილში `store_logo_url` და `store_banner_url` ველებს, ასევე ქმნის `store-branding` storage bucket-ს შესაბამისი policy-ებით. ეს migration გაუშვი სანამ მაღაზიის ლოგოსა და cover/banner ატვირთვას გამოიყენებ.


## Payments automation prep

ეს ვერსია boost-ებისთვის ამატებს:

- TBC callback + return driven status sync
- seller/admin manual `სტატუსის გადამოწმება` ღილაკებს
- `listing_boost_order_events` audit trail-ს
- დამატებით payment timestamps ველებს (`paid_at`, `last_payment_sync_at`, `cancelled_at`)

დეტალური ნაბიჯები იხილე `PAYMENTS_SETUP_KA.md` ფაილში.
