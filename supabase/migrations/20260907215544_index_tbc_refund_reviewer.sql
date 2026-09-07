-- Covers the admin reviewer foreign key without changing payment semantics.
create index if not exists listing_boost_refund_reviewed_by_idx
  on public.listing_boost_refund_requests(reviewed_by)
  where reviewed_by is not null;
