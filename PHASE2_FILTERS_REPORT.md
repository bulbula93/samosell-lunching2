# Phase 2 — Filters and Recently Viewed cleanup

Updated files:
- components/listings/CatalogFiltersPanel.tsx
- components/listings/CatalogLandingFilters.tsx
- components/listings/RecentlyViewedRail.tsx

What changed:
- Removed direct setState-from-effect pattern in CatalogFiltersPanel.
- Category selection now resets during gender change, not from a follow-up effect.
- Category select value is derived safely from the currently allowed category list.
- Removed direct draft sync effect in CatalogLandingFilters.
- Price draft now refreshes when the price dropdown opens, using current URL filter values.
- Removed unused code warnings in CatalogLandingFilters.
- Reworked RecentlyViewedRail to use an external cached store with useSyncExternalStore.
- The fetch trigger now runs without component-local setState in effects.

Validation:
- eslint passes cleanly for the three updated files.

Notes:
- This phase focuses only on the three requested files.
- Project dependencies and build output were not bundled into the zip.
