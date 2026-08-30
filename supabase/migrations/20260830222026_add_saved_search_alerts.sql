create table if not exists public.saved_searches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  catalog_path text not null,
  q text not null default '',
  category text not null default '',
  item_type text not null default '',
  brand text not null default '',
  size text not null default '',
  color text not null default '',
  city text not null default '',
  condition text not null default '',
  gender text not null default '',
  vip boolean not null default false,
  min_price numeric(12,2),
  max_price numeric(12,2),
  search_terms text[] not null default '{}'::text[],
  is_active boolean not null default true,
  last_matched_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint saved_searches_label_check check (char_length(btrim(label)) between 1 and 180),
  constraint saved_searches_catalog_path_check check (catalog_path like '/catalog%' and char_length(catalog_path) <= 1200),
  constraint saved_searches_min_price_check check (min_price is null or min_price >= 0),
  constraint saved_searches_max_price_check check (max_price is null or max_price >= 0),
  constraint saved_searches_price_range_check check (min_price is null or max_price is null or min_price <= max_price),
  constraint saved_searches_terms_check check (cardinality(search_terms) <= 50),
  constraint saved_searches_user_path_key unique (user_id, catalog_path)
);

create index if not exists idx_saved_searches_user_created
  on public.saved_searches (user_id, created_at desc);
create index if not exists idx_saved_searches_active
  on public.saved_searches (created_at)
  where is_active;

alter table public.saved_searches enable row level security;
drop policy if exists saved_searches_select_own on public.saved_searches;
create policy saved_searches_select_own
on public.saved_searches
for select
to authenticated
using (user_id = auth.uid());

revoke all on table public.saved_searches from public, anon, authenticated;
grant select on table public.saved_searches to authenticated;

create table if not exists public.saved_search_listing_matches (
  saved_search_id uuid not null references public.saved_searches(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  notified_at timestamptz not null default now(),
  primary key (saved_search_id, listing_id)
);

alter table public.saved_search_listing_matches enable row level security;
revoke all on table public.saved_search_listing_matches from public, anon, authenticated;

create or replace function public.save_catalog_search(
  p_label text,
  p_catalog_path text,
  p_q text default '',
  p_category text default '',
  p_item_type text default '',
  p_brand text default '',
  p_size text default '',
  p_color text default '',
  p_city text default '',
  p_condition text default '',
  p_gender text default '',
  p_vip boolean default false,
  p_min_price numeric default null,
  p_max_price numeric default null,
  p_search_terms text[] default '{}'::text[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_id uuid;
  v_count integer;
  v_label text := left(btrim(coalesce(p_label, '')), 180);
  v_path text := left(btrim(coalesce(p_catalog_path, '')), 1200);
  v_q text := left(btrim(coalesce(p_q, '')), 160);
  v_category text := left(btrim(coalesce(p_category, '')), 80);
  v_item_type text := left(btrim(coalesce(p_item_type, '')), 80);
  v_brand text := left(btrim(coalesce(p_brand, '')), 120);
  v_size text := left(btrim(coalesce(p_size, '')), 80);
  v_color text := left(btrim(coalesce(p_color, '')), 80);
  v_city text := left(btrim(coalesce(p_city, '')), 120);
  v_condition text := left(btrim(coalesce(p_condition, '')), 40);
  v_gender text := left(btrim(coalesce(p_gender, '')), 40);
  v_terms text[];
begin
  if v_user_id is null then
    raise exception using errcode = '42501', message = 'authentication_required';
  end if;

  if v_label = '' or v_path = '' or v_path not like '/catalog%' then
    raise exception using errcode = '22023', message = 'invalid_saved_search';
  end if;

  if p_min_price is not null and p_min_price < 0 then
    raise exception using errcode = '22023', message = 'invalid_saved_search';
  end if;
  if p_max_price is not null and p_max_price < 0 then
    raise exception using errcode = '22023', message = 'invalid_saved_search';
  end if;
  if p_min_price is not null and p_max_price is not null and p_min_price > p_max_price then
    raise exception using errcode = '22023', message = 'invalid_saved_search';
  end if;

  if v_q = '' and v_category = '' and v_item_type = '' and v_brand = '' and v_size = ''
     and v_color = '' and v_city = '' and v_condition = '' and v_gender = ''
     and not coalesce(p_vip, false) and p_min_price is null and p_max_price is null then
    raise exception using errcode = '22023', message = 'empty_saved_search';
  end if;

  select coalesce(array_agg(distinct left(btrim(term), 120)) filter (where btrim(term) <> ''), '{}'::text[])
  into v_terms
  from unnest(coalesce(p_search_terms, '{}'::text[])) term;

  if cardinality(v_terms) > 50 then
    raise exception using errcode = '22023', message = 'too_many_search_terms';
  end if;

  select count(*) into v_count
  from public.saved_searches
  where user_id = v_user_id;

  if v_count >= 20 and not exists (
    select 1 from public.saved_searches where user_id = v_user_id and catalog_path = v_path
  ) then
    raise exception using errcode = '54000', message = 'saved_search_limit_reached';
  end if;

  insert into public.saved_searches (
    user_id, label, catalog_path, q, category, item_type, brand, size, color, city,
    condition, gender, vip, min_price, max_price, search_terms, is_active, updated_at
  ) values (
    v_user_id, v_label, v_path, v_q, v_category, v_item_type, v_brand, v_size, v_color, v_city,
    v_condition, v_gender, coalesce(p_vip, false), p_min_price, p_max_price, v_terms, true, now()
  )
  on conflict (user_id, catalog_path) do update set
    label = excluded.label,
    q = excluded.q,
    category = excluded.category,
    item_type = excluded.item_type,
    brand = excluded.brand,
    size = excluded.size,
    color = excluded.color,
    city = excluded.city,
    condition = excluded.condition,
    gender = excluded.gender,
    vip = excluded.vip,
    min_price = excluded.min_price,
    max_price = excluded.max_price,
    search_terms = excluded.search_terms,
    is_active = true,
    updated_at = now()
  returning id into v_id;

  return v_id;
end;
$$;

revoke all on function public.save_catalog_search(text,text,text,text,text,text,text,text,text,text,text,boolean,numeric,numeric,text[]) from public, anon, authenticated;
grant execute on function public.save_catalog_search(text,text,text,text,text,text,text,text,text,text,text,boolean,numeric,numeric,text[]) to authenticated;

create or replace function public.set_saved_search_active(p_saved_search_id uuid, p_active boolean)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  if auth.uid() is null then return false; end if;
  update public.saved_searches
  set is_active = coalesce(p_active, false), updated_at = now()
  where id = p_saved_search_id and user_id = auth.uid();
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;
revoke all on function public.set_saved_search_active(uuid,boolean) from public, anon, authenticated;
grant execute on function public.set_saved_search_active(uuid,boolean) to authenticated;

create or replace function public.delete_saved_search(p_saved_search_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  if auth.uid() is null then return false; end if;
  delete from public.saved_searches
  where id = p_saved_search_id and user_id = auth.uid();
  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;
revoke all on function public.delete_saved_search(uuid) from public, anon, authenticated;
grant execute on function public.delete_saved_search(uuid) to authenticated;

create or replace function public.notify_saved_searches_for_listing(p_listing_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  l record;
  s record;
  v_haystack text;
  v_inserted uuid;
  v_count integer := 0;
begin
  select lc.* into l
  from public.listings_catalog lc
  where lc.id = p_listing_id and lc.status = 'active';

  if not found then return 0; end if;

  v_haystack := lower(concat_ws(' ', coalesce(l.title,''), coalesce(l.description,''), coalesce(l.category_name,''), coalesce(l.brand_name,'')));

  for s in
    select ss.*
    from public.saved_searches ss
    where ss.is_active
      and ss.user_id <> l.seller_id
      and l.published_at is not null
      and l.published_at >= ss.created_at
      and (
        ss.category = ''
        or (ss.category in ('women','men','kids') and l.gender = ss.category)
        or (ss.category in ('accessories','vintage') and l.category_slug = ss.category)
        or ss.category in ('footwear','bags')
        or ss.category not in ('women','men','kids','accessories','vintage','footwear','bags')
      )
      and (ss.brand = '' or l.brand_name = ss.brand)
      and (ss.size = '' or l.size_label = ss.size)
      and (ss.color = '' or l.color = ss.color)
      and (ss.city = '' or l.city = ss.city)
      and (ss.condition = '' or l.condition = ss.condition)
      and (
        ss.gender = ''
        or ss.category in ('women','men','kids')
        or l.gender = ss.gender
      )
      and (not ss.vip or l.is_vip = true)
      and (ss.min_price is null or l.price >= ss.min_price)
      and (ss.max_price is null or l.price <= ss.max_price)
      and (
        cardinality(ss.search_terms) = 0
        or exists (
          select 1 from unnest(ss.search_terms) term
          where v_haystack like '%' || lower(term) || '%'
        )
      )
  loop
    v_inserted := null;
    insert into public.saved_search_listing_matches (saved_search_id, listing_id)
    values (s.id, l.id)
    on conflict do nothing
    returning saved_search_id into v_inserted;

    if v_inserted is null then
      continue;
    end if;

    insert into public.notifications (
      user_id, type, title, body, href, listing_id, event_key, metadata
    ) values (
      s.user_id,
      'saved_search_match',
      'ახალი ნივთი შენს ძებნაში',
      left(s.label || ': ' || l.title || ' — ' || trim(to_char(l.price, 'FM999999990.00')) || ' ' || l.currency, 500),
      '/listing/' || l.slug,
      l.id,
      'saved_search:' || s.id::text || ':listing:' || l.id::text,
      jsonb_build_object('saved_search_id', s.id, 'saved_search_label', s.label)
    )
    on conflict (event_key) do nothing;

    update public.saved_searches
    set last_matched_at = now(), updated_at = now()
    where id = s.id;

    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.notify_saved_searches_for_listing(uuid) from public, anon, authenticated;

create or replace function public.trigger_saved_search_alerts()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active' then
    perform public.notify_saved_searches_for_listing(new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.trigger_saved_search_alerts() from public, anon, authenticated;

drop trigger if exists listings_saved_search_alerts on public.listings;
create trigger listings_saved_search_alerts
after insert or update of status, title, description, price, condition, gender, color, city, category_id, brand_id, size_id, published_at, is_vip, vip_until
on public.listings
for each row
execute function public.trigger_saved_search_alerts();
