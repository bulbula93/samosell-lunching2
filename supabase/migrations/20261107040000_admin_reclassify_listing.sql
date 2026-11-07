-- Admins can move a listing to the right section (category) and gender, e.g. a kids'
-- jacket uploaded without the kids section. Same pattern as admin_manage_listing:
-- security definer + is_current_user_admin() + admin_audit_log entry.
alter table public.admin_audit_log drop constraint if exists admin_audit_log_action_check;
alter table public.admin_audit_log add constraint admin_audit_log_action_check check (action = any (array[
  'listing.hide', 'listing.restore', 'listing.reclassify',
  'user.suspend', 'user.restore', 'seller.verify', 'seller.unverify',
  'category.update', 'support.review', 'support.resolve', 'support.close', 'support.reopen'
]));

create or replace function public.admin_reclassify_listing(
  p_listing_id uuid,
  p_category_id bigint,
  p_gender text,
  p_note text default ''
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_note text := btrim(coalesce(p_note, ''));
  v_seller_id uuid;
  v_prev_category bigint;
  v_prev_gender text;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;
  if not public.is_current_user_admin() then
    raise exception using errcode = 'P0001', message = 'not_authorized';
  end if;
  if char_length(v_note) > 2000 then
    raise exception using errcode = 'P0001', message = 'admin_note_too_long';
  end if;
  if p_gender is null or p_gender not in ('women', 'men', 'unisex', 'kids') then
    raise exception using errcode = 'P0001', message = 'invalid_gender';
  end if;
  if not exists (select 1 from public.categories c where c.id = p_category_id and c.is_active) then
    raise exception using errcode = 'P0001', message = 'invalid_category';
  end if;

  select l.seller_id, l.category_id, l.gender
    into v_seller_id, v_prev_category, v_prev_gender
  from public.listings l
  where l.id = p_listing_id
  for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'listing_not_found';
  end if;

  if v_prev_category is not distinct from p_category_id and v_prev_gender is not distinct from p_gender then
    return 'unchanged';
  end if;

  update public.listings
  set category_id = p_category_id, gender = p_gender, updated_at = now()
  where id = p_listing_id;

  insert into public.admin_audit_log (actor_id, action, target_listing_id, target_user_id, note, metadata)
  values (
    v_actor_id, 'listing.reclassify', p_listing_id, v_seller_id, nullif(v_note, ''),
    jsonb_build_object(
      'previous_category_id', v_prev_category, 'next_category_id', p_category_id,
      'previous_gender', v_prev_gender, 'next_gender', p_gender
    )
  );
  return 'updated';
end;
$$;

revoke all on function public.admin_reclassify_listing(uuid, bigint, text, text) from public, anon;
grant execute on function public.admin_reclassify_listing(uuid, bigint, text, text) to authenticated;
