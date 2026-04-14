# Phase 9 — Product page strict mock alignment

Updated the listing detail page to match the provided product-page mock more closely.

## Changed
- Removed the extra report block from the main product area.
- Updated the gallery to always show 5 thumbnail slots like the mock.
- Tightened the right-side product info block to match the screenshot structure.
- Changed seller rating row to show the compact mock-style `(4.3)` display.
- Updated related products section to render 5 cards across on desktop.
- Restyled related product cards to use the mock-style seller line, stars, size text, price line, and discount pill.

## Main files
- `app/listing/[slug]/page.tsx`
- `components/listings/ListingGallery.tsx`
- `components/listings/ListingOverviewCard.tsx`
- `components/listings/SimilarListingsSection.tsx`
- `components/listings/ProductRelatedListingCard.tsx`

## Verification
- `npm run lint` passes.
