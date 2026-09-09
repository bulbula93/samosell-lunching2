-- PR #4: authoritative, bounded uploads and authenticated analytics.
create table public.story_upload_plans (
  story_id uuid primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp','video/mp4','video/webm')),
  expected_size bigint not null check (expected_size between 1 and 26214400),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '10 minutes',
  uploaded_at timestamptz,
  validated_at timestamptz,
  duration_ms integer check (duration_ms between 1 and 15000),
  revoked_at timestamptz,
  published_at timestamptz
);
create index story_upload_plans_user_created_idx on public.story_upload_plans(user_id,created_at);
create index story_upload_plans_unpublished_expiry_idx on public.story_upload_plans(expires_at) where published_at is null;
create index stories_media_path_idx on public.stories(media_path);
alter table public.story_upload_plans enable row level security;
revoke all on public.story_upload_plans from public,anon,authenticated;
grant select,update,delete on public.story_upload_plans to service_role;

create function public.prepare_story_upload(p_mime_type text,p_size bigint)
returns table(story_id uuid,media_path text)
language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_id uuid:=gen_random_uuid(); v_path text; v_ext text; v_allowed boolean;
begin
  if v_user is null then raise exception 'not_authenticated'; end if;
  if not exists(select 1 from public.profiles where id=v_user and not is_suspended) then raise exception 'account_suspended'; end if;
  v_ext:=case p_mime_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' when 'video/mp4' then 'mp4' when 'video/webm' then 'webm' end;
  if v_ext is null or p_size is null or p_size<1 or p_size>(case when p_mime_type like 'image/%' then 12582912 else 26214400 end) then raise exception 'invalid_story_media_size'; end if;
  select allowed into v_allowed from public.consume_action_rate_limit('story_upload',3600,20);
  if not coalesce(v_allowed,false) then raise exception 'story_rate_limited'; end if;
  v_path:=v_user::text||'/'||v_id::text||'/'||gen_random_uuid()::text||'.'||v_ext;
  insert into public.story_upload_plans(story_id,user_id,media_path,mime_type,expected_size) values(v_id,v_user,v_path,p_mime_type,p_size);
  return query select v_id,v_path;
end; $$;
revoke all on function public.prepare_story_upload(text,bigint) from public,anon;
grant execute on function public.prepare_story_upload(text,bigint) to authenticated;

-- Only server-issued signed uploads can insert; restrictive policies also guard
-- against broader permissive policies added for other buckets.
drop policy if exists "users can upload own story media" on storage.objects;
drop policy if exists "users can update own story media" on storage.objects;
drop policy if exists "users can delete own story media" on storage.objects;
create policy "deny direct story insert" on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id<>'story-media');
create policy "deny direct story update" on storage.objects as restrictive for update to anon,authenticated using(bucket_id<>'story-media') with check(bucket_id<>'story-media');
create policy "deny direct story delete" on storage.objects as restrictive for delete to anon,authenticated using(bucket_id<>'story-media');

-- Signed uploads use Storage's privileged role. Enforce the exact authorized
-- object at the DB boundary too. Storage's permission preflight omits final size
-- in a rolled-back transaction; actual uploads have size, MIME and cacheControl.
create function public.guard_story_storage_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_plan public.story_upload_plans%rowtype;
begin
  if tg_op='UPDATE' then
    if old.bucket_id='story-media' and (new.bucket_id is distinct from old.bucket_id or new.name is distinct from old.name or new.metadata is distinct from old.metadata) then raise exception 'story_media_immutable'; end if;
    if old.bucket_id='story-media' then return new; end if;
  end if;
  if new.bucket_id<>'story-media' then return new; end if;
  select * into v_plan from public.story_upload_plans where media_path=new.name for update;
  if not found or v_plan.expires_at<=clock_timestamp() or v_plan.revoked_at is not null or v_plan.uploaded_at is not null then raise exception 'story_upload_not_authorized'; end if;
  if new.metadata->>'size' is null then return new; end if;
  if (new.metadata->>'size')::bigint is distinct from v_plan.expected_size or new.metadata->>'mimetype' is distinct from v_plan.mime_type or new.metadata->>'cacheControl' is distinct from 'max-age=0' then raise exception 'invalid_story_media_metadata'; end if;
  update public.story_upload_plans set uploaded_at=clock_timestamp() where story_id=v_plan.story_id;
  return new;
end; $$;
revoke all on function public.guard_story_storage_write() from public,anon,authenticated;
create trigger guard_story_storage_write before insert or update on storage.objects for each row execute function public.guard_story_storage_write();

create function public.abort_story_upload(p_story_id uuid) returns text
language plpgsql security definer set search_path='' as $$
declare v_path text;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.story_upload_plans set revoked_at=coalesce(revoked_at,clock_timestamp())
  where story_id=p_story_id and user_id=auth.uid() and published_at is null
  returning media_path into v_path;
  return v_path;
end; $$;
revoke all on function public.abort_story_upload(uuid) from public,anon;
grant execute on function public.abort_story_upload(uuid) to authenticated;

create or replace function public.create_story(
  p_story_id uuid,
  p_media_path text,
  p_media_type text,
  p_caption text default null,
  p_linked_listing_id uuid default null,
  p_media_width integer default null,
  p_media_height integer default null,
  p_duration_ms integer default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_caption text := nullif(btrim(coalesce(p_caption, '')), '');
  v_expected_prefix text;
  v_object record;
  v_plan public.story_upload_plans%rowtype;
  v_allowed boolean;
  v_retry_after integer;
begin
  if v_user_id is null then raise exception using errcode='P0001', message='not_authenticated'; end if;
  if p_story_id is null then raise exception using errcode='P0001', message='story_id_required'; end if;
  if p_media_type not in ('image','video') then raise exception using errcode='P0001', message='invalid_story_media_type'; end if;
  if v_caption is not null and char_length(v_caption) > 280 then raise exception using errcode='P0001', message='story_caption_too_long'; end if;
  if p_media_width is not null and (p_media_width < 1 or p_media_width > 10000) then raise exception using errcode='P0001', message='invalid_story_dimensions'; end if;
  if p_media_height is not null and (p_media_height < 1 or p_media_height > 10000) then raise exception using errcode='P0001', message='invalid_story_dimensions'; end if;
  if p_media_type='video' and (p_duration_ms is null or p_duration_ms < 1 or p_duration_ms > 15000) then raise exception using errcode='P0001', message='story_video_too_long'; end if;
  if p_media_type='image' and p_duration_ms is not null then raise exception using errcode='P0001', message='invalid_story_duration'; end if;
  if exists(select 1 from public.profiles p where p.id=v_user_id and p.is_suspended) then raise exception using errcode='P0001', message='account_suspended'; end if;

  select * into v_plan from public.story_upload_plans where story_id=p_story_id and user_id=v_user_id for update;
  if not found or v_plan.media_path is distinct from p_media_path or v_plan.validated_at is null
    or v_plan.uploaded_at is null or v_plan.revoked_at is not null or v_plan.published_at is not null
    or v_plan.expires_at<=clock_timestamp() then raise exception 'story_upload_not_validated'; end if;
  if p_duration_ms is distinct from v_plan.duration_ms then raise exception 'invalid_story_duration'; end if;

  perform pg_advisory_xact_lock(hashtextextended('stories:' || v_user_id::text, 0));
  if (select count(*) from public.stories s where s.user_id=v_user_id and s.deleted_at is null and s.expires_at>v_now) >= 10 then
    raise exception using errcode='P0001', message='active_story_limit_reached';
  end if;

  v_expected_prefix := v_user_id::text || '/' || p_story_id::text || '/';
  if p_media_path is null or left(p_media_path, char_length(v_expected_prefix)) <> v_expected_prefix
     or p_media_path !~ ('^' || v_user_id::text || '/' || p_story_id::text || '/[0-9a-f-]{36}[.](webp|jpg|png|mp4|webm)$') then
    raise exception using errcode='P0001', message='invalid_story_media_path';
  end if;

  select o.metadata into v_object
  from storage.objects o
  where o.bucket_id='story-media' and o.name=p_media_path;
  if not found then raise exception using errcode='P0001', message='story_media_missing'; end if;
  if coalesce((v_object.metadata->>'size')::bigint, 0) < 1
     or coalesce((v_object.metadata->>'size')::bigint, 0) > 26214400 then
    raise exception using errcode='P0001', message='invalid_story_media_size';
  end if;
  if p_media_type='image' and coalesce(v_object.metadata->>'mimetype','') not in ('image/jpeg','image/png','image/webp') then
    raise exception using errcode='P0001', message='invalid_story_media_type';
  end if;
  if p_media_type='video' and coalesce(v_object.metadata->>'mimetype','') not in ('video/mp4','video/webm') then
    raise exception using errcode='P0001', message='invalid_story_media_type';
  end if;

  if p_linked_listing_id is not null and not exists (
    select 1 from public.listings l
    where l.id=p_linked_listing_id and l.seller_id=v_user_id and l.status='active'
  ) then
    raise exception using errcode='P0001', message='invalid_story_listing';
  end if;

  select r.allowed, r.retry_after_seconds into v_allowed, v_retry_after
  from public.consume_action_rate_limit('story_create', 3600, 20) r;
  if not coalesce(v_allowed,false) then
    raise exception using errcode='P0001', message='story_rate_limited', hint=greatest(coalesce(v_retry_after,60),1)::text;
  end if;

  insert into public.stories(
    id,user_id,media_path,media_type,caption,linked_listing_id,
    media_width,media_height,duration_ms,created_at,expires_at
  ) values (
    p_story_id,v_user_id,p_media_path,p_media_type,v_caption,p_linked_listing_id,
    p_media_width,p_media_height,p_duration_ms,v_now,v_now+interval '24 hours'
  );
  update public.story_upload_plans set published_at=clock_timestamp() where story_id=p_story_id;
  return p_story_id;
end;
$$;

create or replace function public.record_story_listing_click(p_story_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then return false; end if;
  if exists(select 1 from public.profiles where id=v_user_id and is_suspended) then return false; end if;
  if not exists(
    select 1 from public.stories s join public.listings l on l.id=s.linked_listing_id
    join public.profiles p on p.id=s.user_id
    where s.id=p_story_id and s.deleted_at is null and s.expires_at>clock_timestamp()
      and s.user_id<>v_user_id
      and not exists(select 1 from public.user_blocks b where (b.blocker_id=v_user_id and b.blocked_id=s.user_id) or (b.blocker_id=s.user_id and b.blocked_id=v_user_id))
      and l.status='active' and l.seller_id=s.user_id and not p.is_suspended
  ) then return false; end if;
  insert into public.story_listing_clicks(story_id,user_id) values(p_story_id,v_user_id)
  on conflict(story_id,user_id) where user_id is not null do nothing;
  return found;
end;
$$;

revoke all on function public.record_story_listing_click(uuid) from public,anon;
grant execute on function public.record_story_listing_click(uuid) to authenticated;
-- Existing NULL rows cannot distinguish historical anonymous events from deleted
-- accounts, so v1 analytics excludes both. No data is deleted by this migration.
create or replace function public.get_my_story_stats()
returns table(story_id uuid,view_count bigint,reply_count bigint,listing_click_count bigint)
language sql stable security definer set search_path=''
as $$
  select s.id,
    (select count(*) from public.story_views v where v.story_id=s.id),
    (select count(*) from public.messages m where m.story_id=s.id and m.sender_id<>s.user_id),
    (select count(*) from public.story_listing_clicks c where c.story_id=s.id and c.user_id is not null and c.user_id<>s.user_id)
  from public.stories s where s.user_id=auth.uid();
$$;

-- Scan actual objects, including pre-plan orphans; API removal deletes bytes.
create or replace function public.list_expired_story_media_for_cleanup(p_limit integer default 100)
returns table(story_id uuid,media_path text)
language sql stable security definer set search_path='' as $$
  select s.id,o.name from storage.objects o
  left join public.stories s on s.media_path=o.name
  where o.bucket_id='story-media' and (
    (s.id is null and o.created_at<now()-interval '2 hours')
    or (s.deleted_at is not null or s.expires_at<now()-interval '7 days')
  ) order by o.created_at limit least(greatest(coalesce(p_limit,100),1),500);
$$;
revoke all on function public.list_expired_story_media_for_cleanup(integer) from public,anon,authenticated;
grant execute on function public.list_expired_story_media_for_cleanup(integer) to service_role;

-- Ordinary direct inserts may only create text messages. Story replies must use
-- the checked RPC (active story, authoritative recipient, blocks, rate limit).
create policy "story replies require rpc" on public.messages as restrictive for insert to authenticated
with check(message_type='text' and story_id is null);

-- Public URLs otherwise keep serving deleted/expired media indefinitely.
update storage.buckets set public=false where id='story-media';
create policy "read visible story media" on storage.objects for select to anon,authenticated
using(bucket_id='story-media' and exists(select 1 from public.stories s where s.media_path=name and s.deleted_at is null and s.expires_at>now()));
create policy "admins read story media" on storage.objects for select to authenticated
using(bucket_id='story-media' and (select public.is_current_user_admin()));

-- Keep replacement RPC grants explicit as well as preserving original grants.
revoke all on function public.create_story(uuid,text,text,text,uuid,integer,integer,integer) from public,anon;
grant execute on function public.create_story(uuid,text,text,text,uuid,integer,integer,integer) to authenticated;
revoke all on function public.get_my_story_stats() from public,anon;
grant execute on function public.get_my_story_stats() to authenticated;
