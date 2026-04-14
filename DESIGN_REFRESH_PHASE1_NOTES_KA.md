SamoSell — დიზაინის განახლება / ფაზა 1

ამ zip-ში შესრულებულია Variant 2-ის პირველი ეტაპი:

1. Header redesign
- უფრო სუფთა sticky header
- desktop search bar
- მკაფიო primary CTA
- mobile dropdown menu
- auth/dashboard actions უფრო დალაგებულად

2. Homepage refresh
- ახალი hero ვიზუალი
- category cards section
- seller promo block
- საერთო ფერებისა და spacing-ის refresh

3. Catalog page refresh
- ახალი intro block
- quick filters / active filters ვიზუალური polish
- filter panel უფრო სუფთა სტილით
- mobile filter drawer იგივე ლოგიკით, მაგრამ ახალი ვიზუალით

4. Product card redesign
- უფრო premium card layout
- უკეთესი hierarchy: image → title → price → details → seller
- condition / verified / promotion badges
- უფრო სუფთა spacing და hover state

შეცვლილი მთავარი ფაილები:
- app/globals.css
- app/page.tsx
- app/catalog/page.tsx
- components/layout/SiteHeader.tsx
- components/home/HeroSection.tsx
- components/listings/CatalogFiltersPanel.tsx
- components/listings/CatalogListingCard.tsx
- components/listings/PublicCatalogSection.tsx

შენიშვნა:
- data flow არ შეცვლილა; Supabase query-ები და marketplace logic დარჩა არსებულ არქიტექტურაზე.
- footer, seller page, listing details page და forms ამ ფაზაში სრულად არ გადაკეთებულა.
- შემდეგი საუკეთესო ნაბიჯია: Product details page + Seller profile + Footer/style consistency.
