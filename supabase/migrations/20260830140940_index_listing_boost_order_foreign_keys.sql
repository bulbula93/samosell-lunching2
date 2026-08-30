create index if not exists idx_listing_boost_orders_product_id
  on public.listing_boost_orders (product_id);

create index if not exists idx_listing_boost_orders_reviewed_by
  on public.listing_boost_orders (reviewed_by)
  where reviewed_by is not null;
