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

    insert into public.admin_audit_log (
      actor_id,
      action,
      target_listing_id,
      target_user_id,
      note,
      metadata
    )
    select
      v_actor_id,
      'listing.hide',
      l.id,
      p_user_id,
      nullif(v_note, ''),
      jsonb_build_object(
        'previous_status', l.status,
        'next_status', 'archived',
        'source', 'user.suspend'
      )
    from public.listings l
    where l.seller_id = p_user_id
      and l.status in ('active', 'reserved');

    get diagnostics v_archived_count = row_count;

    update public.listings
    set status = 'archived', updated_at = now()
    where seller_id = p_user_id
      and status in ('active', 'reserved');

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

  if p_user_id = v_actor_id then
    raise exception using errcode = 'P0001', message = 'cannot_change_self_verification';
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
