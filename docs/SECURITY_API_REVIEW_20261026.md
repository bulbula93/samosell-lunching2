# API route inventory — 2026-10-26

Static inventory of every App Router API handler at the audited revision. This is an audit map, not proof that all possible request sequences were tested. Dynamic coverage is recorded in SECURITY_AUDIT_20261026.md.

| Route | Methods | Boundary / review notes |
|---|---|---|
| `/api/admin/agent` | POST | Authenticated admin; added same-origin CSRF boundary and 32 KiB streaming limit. Existing read-only model/fallback behavior retained. |
| `/api/admin/growth/meta-spend/sync` | POST | Same-origin, getUser, admin profile; server-side integration. |
| `/api/ads/click` | GET | Public ad redirect/tracking; public ad eligibility and URL validation in helpers. |
| `/api/ads/events` | POST | Public impression/click tracking; bounded payload and event validation; anonymous abuse remains a monitoring concern. |
| `/api/catalog-engagement` | POST | Public catalog telemetry; bounded validation, durable rate windows; existing DB security tests. |
| `/api/chats/media/[messageId]` | GET | Private message lookup and participant/admin support checks before signed media delivery. |
| `/api/growth/events` | POST | Public growth collection; bounded/schema validated, consent/dedup handling; do not treat client telemetry as financial truth. |
| `/api/home-personalization` | GET | Cookie-authenticated personal response; public HTML cache separated; privacy regression suite. |
| `/api/internal/growth/meta-spend/sync` | GET | Server-only secret-authenticated sync; production settings unchanged. |
| `/api/internal/story-cleanup` | POST | Secret-authenticated bounded cleanup; no audit invocation against Production. |
| `/api/internal/tbc/reconcile` | GET | Secret-authenticated bounded reconciliation; no audit invocation against Production. |
| `/api/listing-view` | DELETE,POST | Public measurement; validation/dedup/rate-limit tests; counters not authoritative payments. |
| `/api/monitoring/client-error` | POST | Added same-origin + 8 KiB streaming limit; raw arbitrary payload removed from logs, categorical metadata/fingerprint only. |
| `/api/payments/flitt/callback` | POST | Bounded body, signature, merchant/order/payment/amount/currency checks, independent provider status API, service finalizers; mocked tests only. |
| `/api/payments/flitt/return` | GET,POST | Browser redirect/status display; not an entitlement-activation authority. |
| `/api/payments/flitt/test/checkout` | POST | Admin only; added same-origin CSRF check; feature flag/mode constraints. No real payment executed. |
| `/api/push/subscription` | GET,POST,DELETE | Same-origin, authenticated owner, fixed action rate limit, endpoint validation. Live provider calls not made during audit. |
| `/api/recently-viewed` | GET | Consent/preferences path; public eligible listing projection; privacy regression suite. |
| `/api/recommendations` | GET | Public eligible listing recommendations; no trusted entitlement mutation. |
| `/api/seller-phone` | POST | Public seller disclosure workflow; getUser/rate/eligibility helpers reviewed; intended seller contact data. |
| `/api/stories/[ownerId]` | GET | Owner story feed with visibility/expiry/block checks; story DB security suite. |
| `/api/stories/media/[storyId]` | GET | Private bucket delivery after live story visibility/authorization checks. |
| `/api/tbc/boosts/return` | GET | Browser return; server-to-server synchronization with payment identity; no browser status grants paid features. |
| `/api/tbc/checkout/callback` | POST | Bounded payment ID input; authoritative server verification plus DB identity/amount/currency binding. No standalone incoming signature relied upon. |
| `/api/web-vitals` | POST | Public performance telemetry; validation/dedup; treat as untrusted measurements. |

## Server Actions

Next.js origin/host checks remain enabled; no broad allowedOrigins wildcard added. Authorization is checked inside actions/helpers rather than relying on hidden buttons or route middleware. Existing listing/chat/admin/ads/order/Story mutation tests run in the full suite.

Inventory:
- `app/admin/actions.ts`
- `app/admin/ads/actions.ts`
- `app/admin/categories/actions.ts`
- `app/admin/payments/actions.ts`
- `app/admin/search/actions.ts`
- `app/admin/support/actions.ts`
- `app/admin/support/chats/actions.ts`
- `app/advertise/actions.ts`
- `app/catalog/saved-search-actions.ts`
- `app/contact/actions.ts`
- `app/dashboard/billing/actions.ts`
- `app/dashboard/boosts/actions.ts`
- `app/dashboard/chats/actions.ts`
- `app/dashboard/chats/commerce-actions.ts`
- `app/dashboard/listings/actions.ts`
- `app/dashboard/listings/form-actions.ts`
- `app/dashboard/notifications/actions.ts`
- `app/dashboard/orders/actions.ts`
- `app/dashboard/profile/actions.ts`
- `app/dashboard/saved-searches/actions.ts`
- `app/favorites/actions.ts`
- `app/moderation/actions.ts`
- `app/reviews/actions.ts`
- `app/seller/actions.ts`
- `app/stories/actions.ts`
