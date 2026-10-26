# SECURITY DEFINER inventory — 2026-10-26

Source: read-only PostgreSQL definitions and effective role privileges. Fingerprints are SHA-256; no user rows or credentials.

Each callable warning is reviewed below. Static authorization review is distinct from live QA coverage. Public catalog helpers intentionally require no auth.uid(); admin/participant RPCs keep their existing grants and enforce authorization internally. No raw user metadata is used for admin authorization in the reviewed functions.

| Function | anon | auth | Authorization/review disposition | QA definition drift | SHA-256 |
|---|---|---|---|---|---|
| `abort_story_upload(uuid)` | False | True | auth.uid ownership or visible story/blocked-user checks; upload plans and mutation limits reviewed | different; do not assume parity | `c12a004db4015921` |
| `admin_manage_listing(uuid,text,text)` | False | True | auth.uid + admin check before mutations; role grant intentional | same | `545f868709ccce33` |
| `admin_manage_support_ticket(uuid,text,text)` | False | True | auth.uid + admin check before mutations; role grant intentional | same | `574ecf433a9b48e5` |
| `admin_manage_user(uuid,text,text)` | False | True | auth.uid + admin check before mutations; role grant intentional | same | `3710e20aa4faf934` |
| `admin_mark_support_chat_read(uuid)` | False | True | auth.uid + admin check before mutations; role grant intentional | absent | `bfc5541683834fb4` |
| `admin_send_support_message(uuid,text,uuid)` | False | True | auth.uid + admin check before mutations; role grant intentional | absent | `7ea8fce555e8e016` |
| `admin_update_category(bigint,text,text,integer,boolean,text)` | False | True | auth.uid + admin check before mutations; role grant intentional | same | `78a118d03ead4d95` |
| `complete_chat_sale(uuid)` | False | True | actor/participant or seller/buyer match; checked before mutation; messaging rate limits/dedup reviewed | same | `a16b41a7581c6c43` |
| `consume_action_rate_limit(text,integer,integer)` | False | True | auth.uid-owned counter; fixed action/window/hit allowlist | different; do not assume parity | `0d8b305d54bb567d` |
| `create_chat_offer(uuid,numeric)` | False | True | actor/participant or seller/buyer match; checked before mutation; messaging rate limits/dedup reviewed | same | `015c33d41fcc214f` |
| `create_story(uuid,text,text,text,uuid,integer,integer,integer)` | False | True | auth.uid ownership or visible story/blocked-user checks; upload plans and mutation limits reviewed | different; do not assume parity | `a529ce542069d70f` |
| `delete_own_story(uuid)` | False | True | auth.uid ownership or visible story/blocked-user checks; upload plans and mutation limits reviewed | different; do not assume parity | `3fb9f5faa481840b` |
| `delete_saved_search(uuid)` | False | True | auth.uid-owned saved search; bounded saved-search count | same | `96b2eb1a3c13c8b4` |
| `get_catalog_public_facets()` | True | True | active catalog facets only | same | `e7d964a731cc49d6` |
| `get_home_popular_brands(integer)` | True | True | active catalog aggregate; limit capped 20 | same | `044b936f9aa28a72` |
| `get_my_story_stats()` | False | True | auth.uid ownership or visible story/blocked-user checks; upload plans and mutation limits reviewed | different; do not assume parity | `df8ba9a6d4df83c2` |
| `get_own_ad_event_counts()` | False | True | counts joined to auth.uid-owned ad orders | same | `9ccd39de75eb51a5` |
| `get_public_seller_listing_counts(uuid)` | True | True | public seller totals; suspended seller filtered; search_path hardened | same | `3f4b5cb417918ede` |
| `get_search_experiment_assignment(uuid)` | True | True | public experiment assignment; no private row output | same | `95d35ac66bddc604` |
| `get_search_query_expansions(text)` | True | True | active search aliases only | same | `138815b9b7bd4e1a` |
| `is_selected_listing_buyer(uuid)` | False | True | returns caller-specific boolean only | same | `c69ea42b4a2a2097` |
| `mark_all_notifications_read()` | False | True | auth.uid target/participant conditions; user-scoped update | different; do not assume parity | `74a161f25218fd87` |
| `mark_chat_notifications_read(uuid)` | False | True | actor/participant or seller/buyer match; checked before mutation; messaging rate limits/dedup reviewed | same | `f3dae46aaa600fe3` |
| `mark_chat_read(uuid)` | False | True | actor/participant or seller/buyer match; checked before mutation; messaging rate limits/dedup reviewed | same | `08e5ca5dd436c790` |
| `mark_notification_read(uuid)` | False | True | auth.uid target/participant conditions; user-scoped update | same | `90e011d32eb8f5e9` |
| `marketing_growth_snapshot()` | True | True | CONFIRMED Medium internal aggregate exposure; revoke anon/auth, retain service_role | absent | `8f8e1a31dd497d2f` |
| `open_profile_direct_chat(uuid)` | False | True | actor/participant or seller/buyer match; checked before mutation; messaging rate limits/dedup reviewed | different; do not assume parity | `48df85c8ec2ad5a1` |
| `prepare_story_upload(text,bigint)` | False | True | auth.uid ownership or visible story/blocked-user checks; upload plans and mutation limits reviewed | different; do not assume parity | `24c60f153b616e8c` |
| `record_search_impression(uuid,text,jsonb,text,integer,integer,uuid[])` | True | True | bounded anonymous telemetry; residual write-abuse risk | same | `129a3886aa051b5d` |
| `record_search_interaction(uuid,text,uuid)` | True | True | existing recent impression/listing binding + dedup; anonymous telemetry abuse risk | same | `fb1a86947e4e980e` |
| `record_story_listing_click(uuid)` | False | True | auth.uid ownership or visible story/blocked-user checks; upload plans and mutation limits reviewed | different; do not assume parity | `c349529b39c61585` |
| `record_story_view(uuid)` | False | True | auth.uid ownership or visible story/blocked-user checks; upload plans and mutation limits reviewed | different; do not assume parity | `237dd8cb496a0f2a` |
| `release_chat_reservation(uuid)` | False | True | actor/participant or seller/buyer match; checked before mutation; messaging rate limits/dedup reviewed | same | `1dad549f3b38b7b1` |
| `reply_to_story(uuid,text,uuid)` | False | True | auth.uid ownership or visible story/blocked-user checks; upload plans and mutation limits reviewed | different; do not assume parity | `a372f6342f0f9702` |
| `reserve_chat_listing(uuid)` | False | True | actor/participant or seller/buyer match; checked before mutation; messaging rate limits/dedup reviewed | same | `43751e0dbb2eef08` |
| `respond_chat_offer(uuid,text)` | False | True | actor/participant or seller/buyer match; checked before mutation; messaging rate limits/dedup reviewed | same | `1f07657fa6ddfe53` |
| `review_moderation_report(text,uuid,text,text)` | False | True | auth.uid + admin check before mutations; role grant intentional | same | `e57e0fb0fa8b36c7` |
| `review_story_report(uuid,text,text)` | False | True | auth.uid + admin check before mutations; role grant intentional | different; do not assume parity | `d0766c949b1f8319` |
| `save_catalog_search(text,text,text,text,text,text,text,text,text,text,text,boolean,numeric,numeric,text[])` | False | True | auth.uid-owned saved search; bounded saved-search count | same | `90f3ad646a05d91a` |
| `search_catalog_ranked(text,text,text[],text,text,text,text,text,text,boolean,numeric,numeric,integer,integer,text)` | True | True | active catalog wrapper; delegates to bounded search routines | same | `60d61e4abba5974f` |
| `search_catalog_rescue(text,text,text[],text,text,text,text,text,text,boolean,numeric,numeric,integer,integer,text)` | True | True | active catalog rows; capped 100; SQL parameters | same | `4922103df3132d27` |
| `search_normalize_query_tokens(text)` | True | True | active aliases; input capped 200 chars/8 tokens | same | `ec13c62717005a9a` |
| `send_chat_image_message(uuid,text,text,text,bigint,uuid)` | False | True | actor/participant or seller/buyer match; checked before mutation; messaging rate limits/dedup reviewed | different; do not assume parity | `26bf765513d0ea0c` |
| `send_chat_message(uuid,text,uuid)` | False | True | actor/participant or seller/buyer match; checked before mutation; messaging rate limits/dedup reviewed | different; do not assume parity | `38a2d8f869851ec2` |
| `set_chat_archived(uuid,boolean)` | False | True | actor/participant or seller/buyer match; checked before mutation; messaging rate limits/dedup reviewed | different; do not assume parity | `bca9dc4315f3651a` |
| `set_saved_search_active(uuid,boolean)` | False | True | auth.uid-owned saved search; bounded saved-search count | same | `820ea4e09d815165` |
| `set_story_liked(uuid,boolean)` | False | True | auth.uid ownership or visible story/blocked-user checks; upload plans and mutation limits reviewed | different; do not assume parity | `f61e115755cd760d` |
| `set_story_muted(uuid,boolean)` | False | True | auth.uid ownership or visible story/blocked-user checks; upload plans and mutation limits reviewed | different; do not assume parity | `f72fd896f85e19e6` |
| `set_tiktok_live_status(text,boolean)` | False | True | auth.uid profile only; username format and 4h expiry; no verification of actual TikTok live status | same | `d703739ee9fe5805` |
| `set_user_blocked(uuid,boolean)` | False | True | auth.uid actor bound; target/block validation; residual social-write abuse risk | different; do not assume parity | `508dbeacd92a5c05` |
| `set_user_followed(uuid,boolean)` | False | True | auth.uid actor bound; target/block validation; residual social-write abuse risk | different; do not assume parity | `2f193da233df2520` |
| `start_chat_with_message(uuid,text,uuid)` | False | True | actor/participant or seller/buyer match; checked before mutation; messaging rate limits/dedup reviewed | different; do not assume parity | `e5b1ed4489bde252` |
| `submit_listing_report(uuid,text,text)` | False | True | auth.uid-bound reporter; validation; support RPC rate-limit gap remains Medium | same | `b81bfe62d41bd5b9` |
| `submit_story_report(uuid,text,text)` | False | True | auth.uid ownership or visible story/blocked-user checks; upload plans and mutation limits reviewed | different; do not assume parity | `d95a5d5f366c7a1b` |
| `submit_support_ticket(text,text,text)` | False | True | auth.uid-bound reporter; validation; support RPC rate-limit gap remains Medium | same | `57e2d7bdc9ddc99d` |
| `submit_user_report(uuid,text,text,uuid)` | False | True | auth.uid-bound reporter; validation; support RPC rate-limit gap remains Medium | same | `8e05f80dbe2d58a4` |
| `transition_marketplace_order(uuid,text,timestamp with time zone)` | False | True | buyer/seller match; locked row; expected timestamp; paid/refund transitions forbidden to clients | same | `c5ecd9247a2238be` |
| `upsert_listing_review(uuid,integer,text)` | False | True | auth.uid reviewer; sold listing/selected buyer validation; bounded score/comment | same | `09a9d94521151ace` |
