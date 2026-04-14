create index if not exists listings_status_published_at_idx
  on public.listings (status, published_at desc);

create index if not exists listings_status_price_idx
  on public.listings (status, price);

create index if not exists listing_images_listing_sort_idx
  on public.listing_images (listing_id, sort_order);
