# SamoSell global ad system

## Placement inventory

- `home_hero_left`, `home_hero_right`
- `listing_after_details_left`, `listing_after_details_right`
- `catalog_top_left`, `catalog_top_right`
- `sell_bottom_left`, `sell_bottom_right`
- `profile_inline_left`, `profile_inline_right`

Catalog inline placements are intentionally not enabled yet. The top row provides useful inventory without inserting ads into the product grid or increasing ad density.

## Empty inventory

When no currently active ad exists, every slot renders the native SamoSell contact CTA. Its single configurable destination is `ADVERTISE_WITH_US_HREF` in `lib/ads.ts`. It currently points to the existing safe internal route `/contact?topic=advertising`; the contact page may later add topic-specific copy without changing ad components.

## Inventory and scheduling

`public.ads` stores the advertiser, placement, copy, optional image/link, schedule, priority and active state. A row is displayable only when it is active and the current time is inside its optional start/end window. Higher priority wins, followed by the newest valid row.

Ad images must use a local path or the existing public SamoSell Supabase Storage host. Advertiser destinations accept only safe internal paths or `http`/`https` URLs.

## Tracking and privacy

Impressions and clicks are written to `public.ad_events` by server-only routes. Browser roles have no direct access to that table. A SHA-256 dedupe key limits repeated events from the same request fingerprint, placement, page and ad to one write per ten-minute bucket; raw IP addresses and user-agent strings are not stored.

## Future admin UI

A future server-authorized admin screen needs controls for:

- advertiser name;
- placement key;
- title and description;
- image URL and destination URL;
- active/inactive state;
- start and end timestamps;
- numeric priority.

Admin mutations must remain server-side and must not add direct `anon` or `authenticated` write grants to either ad table.
