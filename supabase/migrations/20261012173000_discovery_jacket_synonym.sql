-- Discovery Phase 3: one verified lexical rescue for a Georgian jacket term.
-- Live inventory audit: searching "ჯაკეტი" returns zero while "ქურთუკი"
-- has 5 active listings. This is a synonym, not a fabricated brand match.
-- No search ranking weights, promotion tiers, VIP rules or user data change.
insert into public.search_query_aliases (canonical_term,alias,kind)
values ('ქურთუკი','ჯაკეტი','synonym')
on conflict (alias_normalized) do nothing;
