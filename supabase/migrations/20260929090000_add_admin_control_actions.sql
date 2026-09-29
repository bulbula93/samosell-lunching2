create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  action text not null check (
    action in (
      'listing.hide',
      'listing.restore',
      'user.suspend',
      'user.restore',
      'seller.verify',
      'seller.unverify'
    )
  ),
  target_listing_id uuid references public.listings(id) on delete set null,
  target_user_id uuid references public.profiles(id) on delete set null,
  note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint admin_audit_log_note_length_guard
    check (note is null or char_length(note) <= 2000),
  constraint admin_audit_log_target_guard
    check (target_listing_id is not null or target_user_id is not null)
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

create index if not exists admin_audit_log_target_listing_idx
  on public.admin_audit_log (target_listing_id, created_at desc)
  where target_listing_id is not null;

create index if not exists admin_audit_log_target_user_idx
  on public.admin_audit_log (target_user_id, created_at desc)
  where target_user_id is not null;

alter table public.admin_audit_log enable row level security;

revoke all on table public.admin_audit_log from public, anon, authenticated;

drop policy if exists "admins can read admin audit log" on public.admin_audit_log;
create policy "admins can read admin audit log"
  on public.admin_audit_log
  for select
  to authenticated
  using ((select public.is_current_user_admin()));

grant select on table public.admin_audit_log to authenticated;

create or replace function public.admin_manage_listing(
  p_listing_id uuid,
  p_action text,
  p_note text default ''
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_previous_status text;
  v_next_status text;
  v_seller_id uuid;
  v_seller_suspended boolean;
  v_restore_status text;
  v_note text := btrim(coalesce(p_note, ''));
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if not public.is_current_user_admin() then
    raise exception using errcode = 'P0001', message = 'not_authorized';
  end if;

  if p_action not in ('hide', 'restore') then
    raise exception using errcode = 'P0001', message = 'invalid_admin_listing_action';
  end if;

  if char_length(v_note) > 2000 then
    raise exception using errcode = 'P0001', message = 'admin_note_too_long';
  end if;

  select l.status, l.seller_id
  into v_previous_status, v_seller_id
  from public.listings l
  where l.id = p_listing_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'listing_not_found';
  end if;

  if p_action = 'hide' then
    if v_previous_status not in ('active', 'reserved') then
      raise exception using errcode = 'P0001', message = 'listing_not_hideable';
    end if;

    v_next_status := 'archived';

    update public.listings
    set status = v_next_status, updated_at = now()
    where id = p_listing_id;

    insert into public.admin_audit_log (
      actor_id,
      action,
      target_listing_id,
      target_user_id,
      note,
      metadata
    )
    values (
      v_actor_id,
      'listing.hide',
      p_listing_id,
      v_seller_id,
      nullif(v_note, ''),
      jsonb_build_object(
        'previous_status', v_previous_status,
        'next_status', v_next_status
      )
    );

    return v_next_status;
  end if;

  if v_previous_status <> 'archived' then
    raise exception using errcode = 'P0001', message = 'listing_not_restorable';
  end if;

  select p.is_suspended
  into v_seller_suspended
  from public.profiles p
  where p.id = v_seller_id;

  if coalesce(v_seller_suspended, false) then
    raise exception using errcode = 'P0001', message = 'seller_suspended';
  end if;

  select nullif(a.metadata ->> 'previous_status', '')
  into v_restore_status
  from public.admin_audit_log a
  where a.target_listing_id = p_listing_id
    and a.action = 'listing.hide'
  order by a.created_at desc
  limit 1;

  if v_restore_status not in ('active', 'reserved') then
    raise exception using errcode = 'P0001', message = 'listing_restore_state_missing';
  end if;

  v_next_status := v_restore_status;

  update public.listings
  set status = v_next_status, updated_at = now()
  where id = p_listing_id;

  insert into public.admin_audit_log (
    actor_id,
    action,
    target_listing_id,
    target_user_id,
    note,
    metadata
  )
  values (
    v_actor_id,
    'listing.restore',
    p_listing_id,
    v_seller_id,
    nullif(v_note, ''),
    jsonb_build_object(
      'previous_status', v_previous_status,
      'next_status', v_next_status
    )
  );

  return v_next_status;
end;
$function$;

revoke all on function public.admin_manage_listing(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_manage_listing(uuid, text, text)
  to authenticated;

create or replace function public.admin_manage_user(
  p_user_id uuid,
  p_action text,
  p_note text default ''
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_actor_id uuid := auth.uid();
  v_is_suspended boolean;
  v_is_verified boolean;
  v_is_admin boolean;
  v_note text := btrim(coalesce(p_note, ''));
  v_archived_count integer := 0;
begin
  if v_actor_id is null then
    raise exception using errcode = 'P0001', message = 'not_authenticated';
  end if;

  if not public.is_current_user_admin() then
    raise exception using errcode = 'P0001', message = 'not_authorized';
  end if;

  if p_action not in ('suspend', 'restore', 'verify', 'unverify') then
    raise exception using errcode = 'P0001', message = 'invalid_admin_user_action';
  end if;

  if char_length(v_note) > 2000 then
    raise exception using errcode = 'P0001', message = 'admin_note_too_long';
  end if;

  select p.is_suspended, p.is_seller_verified, p.is_admin
  into v_is_suspended, v_is_verified, v_is_admin
  from public.profiles p
  where p.id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'user_not_found';
  end if;

  if p_action = 'suspend' then
    if p_user_id = v_actor_id then
      raise exception using errcode = 'P0001', message = 'cannot_suspend_self';
    end if;

    if v_is_admin then
      raise exception using errcode = 'P0001', message = 'cannot_suspend_admin';
    end if;

    if v_is_suspended then
      raise exception using errcode = 'P0001', message = 'user_already_suspended';
    end if;

    update public.profiles
    set is_suspended = true, updated_at = now()
    where id = p_user_id;

    update public.listings
    set status = 'archived', updated_at = now()
    where seller_id = p_user_id
      and status in ('active', 'reserved');

    get diagnostics v_archived_count = row_count;

    insert into public.admin_audit_log (
      actor_id,
      action,
      target_user_id,
      note,
      metadata
    )
    values (
      v_actor_id,
      'user.suspend',
      p_user_id,
      nullif(v_note, ''),
      jsonb_build_object(
        'previous_is_suspended', v_is_suspended,
        'next_is_suspended', true,
        'archived_listings_count', v_archived_count
      )
    );

    return 'suspended';
  end if;

  if p_action = 'restore' then
    if not v_is_suspended then
      raise exception using errcode = 'P0001', message = 'user_not_suspended';
    end if;

    update public.profiles
    set is_suspended = false, updated_at = now()
    where id = p_user_id;

    insert into public.admin_audit_log (
      actor_id,
      action,
      target_user_id,
      note,
      metadata
    )
    values (
      v_actor_id,
      'user.restore',
      p_user_id,
      nullif(v_note, ''),
      jsonb_build_object(
        'previous_is_suspended', v_is_suspended,
        'next_is_suspended', false,
        'listings_restored', false
      )
    );

    return 'restored';
  end if;

  if p_action = 'verify' then
    if v_is_verified then
      raise exception using errcode = 'P0001', message = 'seller_already_verified';
    end if;

    update public.profiles
    set is_seller_verified = true, updated_at = now()
    where id = p_user_id;

    insert into public.admin_audit_log (
      actor_id,
      action,
      target_user_id,
      note,
      metadata
    )
    values (
      v_actor_id,
      'seller.verify',
      p_user_id,
      nullif(v_note, ''),
      jsonb_build_object(
        'previous_is_seller_verified', v_is_verified,
        'next_is_seller_verified', true
      )
    );

    return 'verified';
  end if;

  if not v_is_verified then
    raise exception using errcode = 'P0001', message = 'seller_not_verified';
  end if;

  update public.profiles
  set is_seller_verified = false, updated_at = now()
  where id = p_user_id;

  insert into public.admin_audit_log (
    actor_id,
    action,
    target_user_id,
    note,
    metadata
  )
  values (
    v_actor_id,
    'seller.unverify',
    p_user_id,
    nullif(v_note, ''),
    jsonb_build_object(
      'previous_is_seller_verified', v_is_verified,
      'next_is_seller_verified', false
    )
  );

  return 'unverified';
end;
$function$;

revoke all on function public.admin_manage_user(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_manage_user(uuid, text, text)
  to authenticated;
