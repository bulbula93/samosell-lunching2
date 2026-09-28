-- TikTok LIVE badge foundation.
-- TikTok's public Display API does not expose creator LIVE status, so sellers explicitly mark themselves live.
-- The badge is timestamp-gated and automatically disappears after four hours without requiring a cleanup write.

alter table public.profiles
  add column if not exists tiktok_username text,
  add column if not exists tiktok_live_until timestamptz;

alter table public.profiles
  drop constraint if exists profiles_tiktok_username_check;

alter table public.profiles
  add constraint profiles_tiktok_username_check
  check (
    tiktok_username is null
    or tiktok_username ~ '^[A-Za-z0-9._]{2,32}$'
  );

create or replace function public.set_tiktok_live_status(
  p_username text,
  p_live boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_username text := lower(btrim(coalesce(p_username, '')));
  v_live_until timestamptz;
begin
  if v_user_id is null then
    raise exception 'Authentication required.' using errcode = '42501';
  end if;

  v_username := regexp_replace(v_username, '^https?://(www\.)?tiktok\.com/@', '', 'i');
  v_username := split_part(v_username, '/', 1);
  v_username := ltrim(v_username, '@');

  if v_username !~ '^[a-z0-9._]{2,32}$' then
    raise exception 'A valid TikTok username is required.' using errcode = '22023';
  end if;

  v_live_until := case
    when coalesce(p_live, false) then now() + interval '4 hours'
    else null
  end;

  update public.profiles
  set
    tiktok_username = v_username,
    tiktok_live_until = v_live_until,
    updated_at = now()
  where id = v_user_id;

  if not found then
    raise exception 'Profile not found.' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'username', v_username,
    'live_until', v_live_until,
    'is_live', coalesce(p_live, false)
  );
end;
$$;

revoke all on function public.set_tiktok_live_status(text, boolean) from public, anon;
grant execute on function public.set_tiktok_live_status(text, boolean) to authenticated;
