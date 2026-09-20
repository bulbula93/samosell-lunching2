revoke truncate, references, trigger
  on table public.flitt_payment_attempts
  from authenticated;

revoke references, trigger
  on table public.listing_boost_order_events
  from authenticated;

revoke select, references, trigger
  on table public.listing_boost_orders
  from anon;

revoke references, trigger
  on table public.listing_boost_orders
  from authenticated;
