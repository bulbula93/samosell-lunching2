# SamoSell — ავტომატიზებული გადახდების დაყენება (Boost / TBC Checkout)

ეს ვერსია ამზადებს `listing boost`-ების TBC Checkout flow-ს ბანკის production approval-ისთვის. Live checkout ცალკე feature flag-ის გარეშე არასოდეს გამოჩნდება.

## რა მუშაობს

- seller ქმნის boost order-ს
- თუ აირჩევს `TBC Checkout`-ს, გადადის ბანკის დაცულ checkout გვერდზე
- callback route იღებს `PaymentId`-ს და აკეთებს provider status sync-ს
- წარმატებული გადახდა boost order-ს **ავტომატურად ააქტიურებს**
- billing/admin გვერდებზე შეგიძლია ხელითაც გააკეთო `სტატუსის გადამოწმება`
- ინახება payment sync timestamps და event log
- seller-ს შეუძლია შიდა refund მოთხოვნის გაგზავნა; ეს მოთხოვნა ბანკში თანხას ავტომატურად არ აბრუნებს
- admin payment dashboard: `/admin/payments`
- readiness page: `/admin/payments/readiness`

## 1) Supabase SQL

გაუშვი ყველა migration ფაილი სწორ क्रमში, განსაკუთრებით:

- `10_vip_boosts_phase.sql`
- `12_tbc_checkout_integration.sql`
- `18_boost_payment_automation.sql`

## 2) .env.local

აუცილებელი ცვლადები:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_SITE_URL=https://your-domain.com
SITE_URL=https://your-domain.com
SUPABASE_SERVICE_ROLE_KEY=...
TBC_CHECKOUT_ENABLED=false
TBC_API_KEY=...
TBC_CLIENT_ID=...
TBC_CLIENT_SECRET=...
```

Checkout ხელმისაწვდომია მხოლოდ მაშინ, როცა `TBC_CHECKOUT_ENABLED=true` და სამივე TBC credential არსებობს. Credential-ების არსებობა მარტო checkout-ს არ რთავს. ყველა ცვლადი server-only არის და არცერთი არ უნდა იწყებოდეს `NEXT_PUBLIC_`-ით.

## 3) TBC merchant dashboard

TBC merchant panel-ში callback URL მიუთითე:

```
https://your-domain.com/api/tbc/checkout/callback
```

return URL პროექტი თვითონ აგენერირებს თითო order-ზე.

## 4) Network / allowlist

TBC docs-ის მიხედვით callback endpoint-ზე POST უნდა მიიღებოდეს TBC-ს callback IP-ებიდან. merchant ინფრასტრუქტურაში გადაამოწმე firewall / reverse proxy / WAF წესები.

## 5) პირველი ტესტი

1. შექმენი listing
2. შედი `Dashboard -> Promote`
3. აირჩიე `TBC Checkout`
4. მხოლოდ ბანკის approval-ის შემდეგ დაასრულე კონტროლირებული checkout merchant გარემოდან
5. დაბრუნდი `Dashboard -> Billing`
6. თუ callback ცოტა გვიან მოვიდა, დააჭირე `სტატუსის გადამოწმება`

## 6) სად ჩანს სტატუსი

- seller: `/dashboard/billing`
- seller per listing: `/dashboard/listings/[id]/promote`
- admin: `/admin/boosts`
- payment operations: `/admin/payments`
- readiness: `/admin/payments/readiness`

## 7) რას ნიშნავს ახალი ველები

`listing_boost_orders`:

- `checkout_session_started_at` — როდის შეიქმნა provider checkout
- `last_payment_sync_at` — ბოლოს როდის მოხდა status sync
- `paid_at` — წარმატებული checkout-ის დრო
- `cancelled_at` — წარუმატებელი / გაუქმებული checkout-ის დრო
- `failure_reason` — ბოლო შეცდომის ტექსტური მიზეზი

`listing_boost_order_events`:

ინახავს payment flow-ის audit trail-ს: checkout შექმნა, callback, status sync, success/failure, boost activation.

## 8) reconciliation

Seller და admin ხელით ამოწმებენ provider სტატუსს ავტორიზებული server action-ით. ასევე მომზადებულია დაცული endpoint:

`GET /api/internal/tbc/reconcile`

ის მოითხოვს `Authorization: Bearer <CRON_SECRET>`-ს, ამუშავებს მაქსიმუმ 20 ბოლო 14 დღის non-final შეკვეთას და 2 წუთზე ახალ შეკვეთებს არ ეხება. `vercel.json`-ში Cron შეგნებულად არ დამატებულა, რათა plan/billing ქცევა ავტომატურად არ შეიცვალოს.

## 9) refund

Admin-ის `approved` ნიშნავს მხოლოდ შიდა მოთხოვნის დამტკიცებას. რეალური `refunded` ან `partially_refunded` ინახება მხოლოდ მაშინ, როცა TBC-ის ავტორიტეტული სტატუსი არის `Returned` ან `PartialReturned`. `lib/tbc-refunds.ts` ქსელურ მოთხოვნას არ აკეთებს, სანამ ბანკის ზუსტი refund API contract არ დადასტურდება.

## 10) რა არის შემდეგი ეტაპი

როცა ეს flow დადასტურდება, შემდეგ შეგიძლია დაამატო:

- featured slots-ის ფასიანი კალენდარი
- seller subscription plans
- ბანკთან callback IP/signature მოთხოვნების ზუსტი დადასტურება
- finance reconciliation export
- split payout / marketplace settlement
