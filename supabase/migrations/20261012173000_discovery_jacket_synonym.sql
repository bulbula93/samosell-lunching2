-- Discovery Phase 3: Georgian terminology correction.
-- "ჟაკეტი" means a blazer/jacket ("პიჯაკი"), not an outdoor coat
-- ("ქურთუკი"). The production dictionary already has the correct alias;
-- this migration merely ensures it exists in environments missing it.
-- It is idempotent: never overwrite any existing alias or alter VIP ranking.
insert into public.search_query_aliases (canonical_term,alias,kind)
values ('პიჯაკი','ჟაკეტი','synonym')
on conflict (alias_normalized) do nothing;
