# Phase 4 — Unused warnings cleanup

ამ ფაზაში გასწორდა eslint-ის დარჩენილი unused warnings.

## გასწორებული ფაილები
- `app/listing/[slug]/page.tsx`
  - ამოღებულია გამოუყენებელი `formatPublishedDate` import
  - ამოღებულია გამოუყენებელი `listingViews` ცვლადი
- `components/dashboard/CreateListingForm.tsx`
  - `gender` გადავიდა უბრალო მუდმივ მნიშვნელობაზე, რადგან setter არ გამოიყენებოდა
- `components/favorites/FavoriteSubmitButton.tsx`
  - `HeartIcon`-დან ამოღებულია გამოუყენებელი `active` prop

## შედეგი
- `npm run lint` გადის warnings-ის გარეშე.
