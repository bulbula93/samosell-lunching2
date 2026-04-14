# SamoSell — ავტომატიზებული გადახდების დაყენება (Boost / TBC Checkout)

ეს ვერსია ამზადებს **პირველ ავტომატიზებულ payment flow-ს** `listing boost`-ებისთვის.

## რა მუშაობს

- seller ქმნის boost order-ს
- თუ აირჩევს `TBC Checkout`-ს, გადადის ბანკის დაცულ checkout გვერდზე
- callback route იღებს `PaymentId`-ს და აკეთებს provider status sync-ს
- წარმატებული გადახდა boost order-ს **ავტომატურად ააქტიურებს**
- billing/admin გვერდებზე შეგიძლია ხელითაც გააკეთო `სტატუსის გადამოწმება`
- ინახება payment sync timestamps და event log

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
TBC_API_KEY=...
TBC_CLIENT_ID=...
TBC_CLIENT_SECRET=...
```

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
4. დაასრულე ტესტური/რეალური checkout merchant გარემოდან
5. დაბრუნდი `Dashboard -> Billing`
6. თუ callback ცოტა გვიან მოვიდა, დააჭირე `სტატუსის გადამოწმება`

## 6) სად ჩანს სტატუსი

- seller: `/dashboard/billing`
- seller per listing: `/dashboard/listings/[id]/promote`
- admin: `/admin/boosts`

## 7) რას ნიშნავს ახალი ველები

`listing_boost_orders`:

- `checkout_session_started_at` — როდის შეიქმნა provider checkout
- `last_payment_sync_at` — ბოლოს როდის მოხდა status sync
- `paid_at` — წარმატებული checkout-ის დრო
- `cancelled_at` — წარუმატებელი / გაუქმებული checkout-ის დრო
- `failure_reason` — ბოლო შეცდომის ტექსტური მიზეზი

`listing_boost_order_events`:

ინახავს payment flow-ის audit trail-ს: checkout შექმნა, callback, status sync, success/failure, boost activation.

## 8) რა არის შემდეგი ეტაპი

როცა ეს flow დადასტურდება, შემდეგ შეგიძლია დაამატო:

- featured slots-ის ფასიანი კალენდარი
- seller subscription plans
- webhook signature / IP hardening
- finance reconciliation export
- split payout / marketplace settlement
