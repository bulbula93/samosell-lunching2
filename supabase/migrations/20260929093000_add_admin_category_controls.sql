alter table public.categories
  add column if not exists navigation_label text,
  add column if not exists sort_order integer not null default 0,
  add column if not exists is_active boolean not null default true;

update public.categories
set
  navigation_label = case slug
    when 'women' then 'ქალებისთვის'
    when 'men' then 'მამაკაცებისთვის'
    when 'accessories' then 'აქსესუარები'
    when 'vintage' then 'ვინტაჟი'
    else coalesce(nullif(btrim(navigation_label), ''), name)
  end,
  sort_order = case slug
    when 'women' then 10
    when 'men' then 20
    when 'accessories' then 30
    when 'vintage' then 40
    else greatest(0, least(1000, id::integer * 10))
  end
where navigation_label is null
   or btrim(navigation_label) = ''
   or sort_order = 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_name_length_guard'
  ) then
    alter table public.categories
      add constraint categories_name_length_guard
      check (char_length(btrim(name)) between 1 and 80);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_navigation_label_length_guard'
  ) then
    alter table public.categories
      add constraint categories_navigation_label_length_guard
      check (
        navigation_label is null
        or char_length(btrim(navigation_label)) between 1 and 80
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.categories'::regclass
      and conname = 'categories_sort_order_guard'
  ) then
    alter table public.categories
      add constraint categories_sort_order_guard
      check (sort_order between 0 and 1000);
  end if;
end
$$;

alter table public.admin_audit_log
  add column if not exists target_category_id bigint
    references public.categories(id) on delete set null;

alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_action_check;

alter table public.admin_audit_log
  add constraint admin_audit_log_action_check
  check (
    action = any (
      array[
        'listing.hide'::text,
        'listing.restore'::text,
        'user.suspend'::text,
        'user.restore'::text,
        'seller.verify'::text,
        'seller.unverify'::text,
        'category.update'::text
      ]
    )
  );

alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_target_guard;

alter table public.admin_audit_log
  add constraint admin_audit_log_target_guard
  check (
    target_listing_id is not null
    or target_user_id is not null
    or target_category_id is not null
  );

create index if not exists admin_audit_log_target_category_idx
  on public.admin_audit_log (target_category_id, created_at desc)
  where target_category_id is not null;

create or replace function public.admin_update_category(
  p_category_id bigint,
  p_name text,
  p_navigation_label text,
  p_sort_order integer,
  p_is_active boolean,
  p_note text default ''
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_name text := btrim(coalesce(p_name, ''));
  v_navigation_label text := nullif(btrim(coalesce(p_navigation_label, '')), '');
  v_note text := btrim(coalesce(p_note, ''));
  v_previous_name text;
  v_previous_navigation_label text;
  v_previous_sort_order integer;
  v_previous_is_active boolean;
  v_slug text;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if not public.is_current_user_admin() then
    raise exception using errcode = 'P0001', message = 'not_authorized';
  end if;

  if char_length(v_name) < 1 or char_length(v_name) > 80 then
    raise exception using errcode = 'P0001', message = 'invalid_category_name';
  end if;

  if v_navigation_label is not null and char_length(v_navigation_label) > 80 then
    raise exception using errcode = 'P0001', message = 'invalid_category_navigation_label';
  end if;

  if p_sort_order is null or p_sort_order < 0 or p_sort_order > 1000 then
    raise exception using errcode = 'P0001', message = 'invalid_category_sort_order';
  end if;

  if char_length(v_note) > 2000 then
    raise exception using errcode = 'P0001', message = 'admin_note_too_long';
  end if;

  select c.name, c.navigation_label, c.sort_order, c.is_active, c.slug
  into
    v_previous_name,
    v_previous_navigation_label,
    v_previous_sort_order,
    v_previous_is_active,
    v_slug
  from public.categories c
  where c.id = p_category_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'category_not_found';
  end if;

  update public.categories
  set
    name = v_name,
    navigation_label = v_navigation_label,
    sort_order = p_sort_order,
    is_active = p_is_active
  where id = p_category_id;

  insert into public.admin_audit_log (
    actor_id,
    action,
    target_category_id,
    note,
    metadata
  )
  values (
    v_actor_id,
    'category.update',
    p_category_id,
    nullif(v_note, ''),
    jsonb_build_object(
      'slug', v_slug,
      'previous', jsonb_build_object(
        'name', v_previous_name,
        'navigation_label', v_previous_navigation_label,
        'sort_order', v_previous_sort_order,
        'is_active', v_previous_is_active
      ),
      'next', jsonb_build_object(
        'name', v_name,
        'navigation_label', v_navigation_label,
        'sort_order', p_sort_order,
        'is_active', p_is_active
      )
    )
  );

  return p_category_id;
end;
$function$;

revoke all on function public.admin_update_category(bigint, text, text, integer, boolean, text)
  from public, anon, authenticated;

grant execute on function public.admin_update_category(bigint, text, text, integer, boolean, text)
  to authenticated;
