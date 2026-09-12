-- SamoSell Stories + Following v1.
-- Public discovery is intentionally limited to active, non-deleted 24-hour
-- stories. All mutations use narrow RPCs; browser roles do not receive direct
-- write privileges on social tables.

create table public.user_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint user_follows_no_self check (follower_id <> following_id)
);

create index user_follows_following_created_idx
  on public.user_follows (following_id, created_at desc);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  media_path text not null,
  media_type text not null,
  caption text,
  linked_listing_id uuid references public.listings(id) on delete set null,
  media_width integer,
  media_height integer,
  duration_ms integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  deleted_at timestamptz,
  constraint stories_media_type_check check (media_type in ('image', 'video')),
  constraint stories_caption_length_check check (caption is null or char_length(caption) <= 280),
  constraint stories_media_path_length_check check (char_length(media_path) between 10 and 500),
  constraint stories_dimensions_check check (
    (media_width is null or media_width between 1 and 10000)
    and (media_height is null or media_height between 1 and 10000)
  ),
  constraint stories_video_duration_check check (
    (media_type = 'image' and duration_ms is null)
    or (media_type = 'video' and duration_ms between 1 and 15000)
  ),
  constraint stories_expiry_check check (expires_at = created_at + interval '24 hours')
);

create index stories_active_created_idx
  on public.stories (created_at desc, user_id)
  where deleted_at is null;
create index stories_user_active_idx
  on public.stories (user_id, expires_at desc, created_at asc)
  where deleted_at is null;
create index stories_linked_listing_idx
  on public.stories (linked_listing_id)
  where linked_listing_id is not null;

create table public.story_views (
  story_id uuid not null references public.stories(id) on delete cascade,
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (story_id, viewer_id)
);

create index story_views_viewer_seen_idx
  on public.story_views (viewer_id, viewed_at desc, story_id);

create table public.story_mutes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  muted_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, muted_user_id),
  constraint story_mutes_no_self check (user_id <> muted_user_id)
);

create table public.story_listing_clicks (
  id bigint generated always as identity primary key,
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index story_listing_clicks_story_created_idx
  on public.story_listing_clicks (story_id, created_at desc);
create unique index story_listing_clicks_authenticated_unique_idx
  on public.story_listing_clicks (story_id, user_id)
  where user_id is not null;

create table public.story_reports (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  story_owner_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null,
  details text not null default '',
  status text not null default 'open',
  moderation_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint story_reports_unique_reporter unique (story_id, reporter_id),
  constraint story_reports_reason_check check (reason in ('spam', 'scam', 'harassment', 'nudity', 'prohibited', 'other')),
  constraint story_reports_details_length_check check (char_length(details) <= 2000),
  constraint story_reports_note_length_check check (moderation_note is null or char_length(moderation_note) <= 2000),
  constraint story_reports_status_check check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  constraint story_reports_no_self check (reporter_id <> story_owner_id)
);

create index story_reports_status_created_idx
  on public.story_reports (status, created_at desc);
create index story_reports_owner_idx
  on public.story_reports (story_owner_id, created_at desc);
create index story_reports_reviewed_by_idx
  on public.story_reports (reviewed_by)
  where reviewed_by is not null;

alter table public.moderation_audit_log
  drop constraint if exists moderation_audit_log_report_kind_check;
alter table public.moderation_audit_log
  add constraint moderation_audit_log_report_kind_check
  check (report_kind in ('listing', 'user', 'story'));
alter table public.moderation_audit_log
  drop constraint if exists moderation_audit_log_action_check;
alter table public.moderation_audit_log
  add constraint moderation_audit_log_action_check
  check (action in ('mark_reviewing','resolve','dismiss','hide_listing','hide_story','suspend_user','restore_user'));

-- Controlled, publicly readable Story media. Files are delivered directly by
-- Supabase Storage to avoid Vercel image transformation amplification.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'story-media',
  'story-media',
  true,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "users can upload own story media"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'story-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "users can read own story media metadata"
on storage.objects for select to authenticated
using (
  bucket_id = 'story-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "users can update own story media"
on storage.objects for update to authenticated
using (
  bucket_id = 'story-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'story-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "users can delete own story media"
on storage.objects for delete to authenticated
using (
  bucket_id = 'story-media'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

alter table public.user_follows enable row level security;
alter table public.stories enable row level security;
alter table public.story_views enable row level security;
alter table public.story_mutes enable row level security;
alter table public.story_listing_clicks enable row level security;
alter table public.story_reports enable row level security;

create policy "public can read follows"
on public.user_follows for select to anon, authenticated
using (true);

create policy "public can read active stories"
on public.stories for select to anon, authenticated
using (
  deleted_at is null
  and expires_at > now()
  and exists (
    select 1 from public.profiles p
    where p.id = stories.user_id and not p.is_suspended
  )
  and (
    (select auth.uid()) is null
    or not exists (
      select 1 from public.user_blocks b
      where (b.blocker_id=(select auth.uid()) and b.blocked_id=stories.user_id)
         or (b.blocker_id=stories.user_id and b.blocked_id=(select auth.uid()))
    )
  )
  and (
    (select auth.uid()) is null
    or not exists (
      select 1 from public.story_mutes sm
      where sm.user_id=(select auth.uid()) and sm.muted_user_id=stories.user_id
    )
  )
);

create policy "owners can read own stories"
on public.stories for select to authenticated
using (user_id = (select auth.uid()));

create policy "admins can read all stories"
on public.stories for select to authenticated
using ((select public.is_current_user_admin()));

create policy "users can read own story mutes"
on public.story_mutes for select to authenticated
using (user_id = (select auth.uid()));

create policy "viewers can read own story views"
on public.story_views for select to authenticated
using (viewer_id = (select auth.uid()));

create policy "reporters and admins can read story reports"
on public.story_reports for select to authenticated
using (
  reporter_id = (select auth.uid())
  or (select public.is_current_user_admin())
);

revoke all on table public.user_follows from public, anon, authenticated;
revoke all on table public.stories from public, anon, authenticated;
revoke all on table public.story_views from public, anon, authenticated;
revoke all on table public.story_mutes from public, anon, authenticated;
revoke all on table public.story_listing_clicks from public, anon, authenticated;
revoke all on table public.story_reports from public, anon, authenticated;

grant select on table public.user_follows to anon, authenticated;
grant select on table public.stories to anon, authenticated;
grant select on table public.story_views to authenticated;
grant select on table public.story_mutes to authenticated;
grant select on table public.story_reports to authenticated;

-- Existing listing chats remain unchanged. Direct chats reuse the same two
-- participant columns but never expose buyer/seller semantics in application UI.
alter table public.chats
  add column chat_type text not null default 'listing';

alter table public.chats alter column listing_id drop not null;

alter table public.chats
  add constraint chats_type_integrity_check check (
    (chat_type = 'listing' and listing_id is not null)
    or (chat_type = 'direct' and listing_id is null)
  ),
  add constraint chats_participants_distinct_check check (buyer_id <> seller_id);

create unique index chats_direct_canonical_pair_unique_idx
  on public.chats (
    least(buyer_id::text, seller_id::text),
    greatest(buyer_id::text, seller_id::text)
  )
  where chat_type = 'direct';

alter table public.messages
  add column message_type text not null default 'text',
  add column story_id uuid references public.stories(id) on delete set null;

alter table public.messages
  add constraint messages_type_integrity_check check (
    (message_type = 'text' and story_id is null)
    or message_type = 'story_reply'
  );

create index messages_story_idx
  on public.messages (story_id, created_at desc)
  where story_id is not null;

drop policy if exists "buyers can create chats for themselves" on public.chats;
create policy "buyers can create listing chats for themselves"
on public.chats for insert to authenticated
with check (
  chat_type = 'listing'
  and buyer_id = (select auth.uid())
  and buyer_id <> seller_id
  and exists (
    select 1
    from public.listings l
    join public.profiles seller_profile on seller_profile.id = l.seller_id
    where l.id = chats.listing_id
      and l.seller_id = chats.seller_id
      and l.status = 'active'
      and not seller_profile.is_suspended
  )
  and not exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = chats.buyer_id and b.blocked_id = chats.seller_id)
       or (b.blocker_id = chats.seller_id and b.blocked_id = chats.buyer_id)
  )
);

drop policy if exists "participants can insert messages" on public.messages;
create policy "participants can insert messages"
on public.messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and char_length(btrim(body)) between 1 and 2000
  and exists (
    select 1
    from public.chats c
    left join public.listings l on l.id = c.listing_id
    where c.id = messages.chat_id
      and ((select auth.uid()) = c.buyer_id or (select auth.uid()) = c.seller_id)
      and (
        (c.chat_type = 'direct' and c.listing_id is null)
        or (c.chat_type = 'listing' and l.status in ('active', 'reserved', 'sold'))
      )
  )
  and not exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.is_suspended
  )
  and not exists (
    select 1
    from public.chats c
    join public.user_blocks b
      on (b.blocker_id = c.buyer_id and b.blocked_id = c.seller_id)
      or (b.blocker_id = c.seller_id and b.blocked_id = c.buyer_id)
    where c.id = messages.chat_id
  )
);

create or replace function public.consume_action_rate_limit(
  p_action text,
  p_window_seconds integer,
  p_max_hits integer
)
returns table(allowed boolean,current_count integer,limit_count integer,retry_after_seconds integer)
language plpgsql security definer set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid(); v_now timestamptz:=now();
  v_row public.user_action_rate_limits%rowtype; v_reset_at timestamptz;
begin
  if v_user_id is null then raise exception using errcode='P0001',message='not_authenticated'; end if;
  if not (
    (p_action='listing_create' and p_window_seconds=3600 and p_max_hits=12)
    or (p_action='listing_upload' and p_window_seconds=3600 and p_max_hits=60)
    or (p_action='listing_status_update' and p_window_seconds=600 and p_max_hits=30)
    or (p_action='order_status_update' and p_window_seconds=600 and p_max_hits=30)
    or (p_action='chat_start' and p_window_seconds=600 and p_max_hits=20)
    or (p_action='chat_message' and p_window_seconds=60 and p_max_hits=20)
    or (p_action='chat_commerce' and p_window_seconds=600 and p_max_hits=20)
    or (p_action='listing_report' and p_window_seconds=3600 and p_max_hits=10)
    or (p_action='push_subscription' and p_window_seconds=600 and p_max_hits=30)
    or (p_action='payment_create' and p_window_seconds=3600 and p_max_hits=10)
    or (p_action='payment_refund' and p_window_seconds=3600 and p_max_hits=5)
    or (p_action='listing_delete' and p_window_seconds=3600 and p_max_hits=6)
    or (p_action='story_upload' and p_window_seconds=3600 and p_max_hits=20)
    or (p_action='story_create' and p_window_seconds=3600 and p_max_hits=20)
    or (p_action='story_report' and p_window_seconds=3600 and p_max_hits=10)
  ) then raise exception using errcode='P0001',message='bad_rate_limit_arguments'; end if;
  insert into public.user_action_rate_limits(user_id,action,window_started_at,hits)
  values(v_user_id,p_action,v_now,0) on conflict(user_id,action) do nothing;
  select * into v_row from public.user_action_rate_limits where user_id=v_user_id and action=p_action for update;
  v_reset_at:=v_row.window_started_at+make_interval(secs=>p_window_seconds);
  if v_now>=v_reset_at then
    update public.user_action_rate_limits set window_started_at=v_now,hits=1 where user_id=v_user_id and action=p_action;
    return query select true,1,p_max_hits,0; return;
  end if;
  if v_row.hits<p_max_hits then
    update public.user_action_rate_limits set hits=v_row.hits+1 where user_id=v_user_id and action=p_action;
    return query select true,v_row.hits+1,p_max_hits,greatest(0,ceil(extract(epoch from (v_reset_at-v_now)))::integer); return;
  end if;
  return query select false,v_row.hits,p_max_hits,greatest(0,ceil(extract(epoch from (v_reset_at-v_now)))::integer);
end;
$$;

create or replace function public.set_user_followed(
  p_following_id uuid,
  p_followed boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_follower_id uuid := auth.uid();
begin
  if v_follower_id is null then
    raise exception using errcode='P0001', message='not_authenticated';
  end if;
  if p_following_id is null or p_following_id = v_follower_id then
    raise exception using errcode='P0001', message='invalid_follow_target';
  end if;
  if not exists (
    select 1 from public.profiles p
    where p.id = p_following_id and not p.is_suspended
  ) then
    raise exception using errcode='P0001', message='user_unavailable';
  end if;
  if exists (
    select 1 from public.profiles p
    where p.id = v_follower_id and p.is_suspended
  ) then
    raise exception using errcode='P0001', message='account_suspended';
  end if;
  if exists (
    select 1 from public.user_blocks b
    where (b.blocker_id=v_follower_id and b.blocked_id=p_following_id)
       or (b.blocker_id=p_following_id and b.blocked_id=v_follower_id)
  ) then
    raise exception using errcode='P0001', message='interaction_blocked';
  end if;

  if coalesce(p_followed, false) then
    insert into public.user_follows(follower_id, following_id)
    values(v_follower_id, p_following_id)
    on conflict do nothing;
    return true;
  end if;

  delete from public.user_follows
  where follower_id=v_follower_id and following_id=p_following_id;
  return false;
end;
$$;

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

  perform pg_advisory_xact_lock(hashtextextended('stories:' || v_user_id::text, 0));
  if (select count(*) from public.stories s where s.user_id=v_user_id and s.deleted_at is null and s.expires_at>v_now) >= 10 then
    raise exception using errcode='P0001', message='active_story_limit_reached';
  end if;

  v_expected_prefix := v_user_id::text || '/' || p_story_id::text || '/';
  if p_media_path is null or left(p_media_path, char_length(v_expected_prefix)) <> v_expected_prefix
     or p_media_path !~ ('^' || v_user_id::text || '/' || p_story_id::text || '/[0-9a-f-]{36}\\.(webp|jpg|png|mp4|webm)$') then
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
  return p_story_id;
end;
$$;

create or replace function public.delete_own_story(p_story_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_updated boolean;
begin
  if v_user_id is null then raise exception using errcode='P0001',message='not_authenticated'; end if;
  update public.stories set deleted_at=coalesce(deleted_at,clock_timestamp())
  where id=p_story_id and user_id=v_user_id and deleted_at is null;
  v_updated:=found;
  return v_updated;
end;
$$;

create or replace function public.set_story_muted(p_muted_user_id uuid, p_muted boolean)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare v_user_id uuid:=auth.uid();
begin
  if v_user_id is null then raise exception using errcode='P0001',message='not_authenticated'; end if;
  if p_muted_user_id is null or p_muted_user_id=v_user_id then raise exception using errcode='P0001',message='invalid_mute_target'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_muted_user_id) then raise exception using errcode='P0001',message='user_unavailable'; end if;
  if coalesce(p_muted,false) then
    insert into public.story_mutes(user_id,muted_user_id) values(v_user_id,p_muted_user_id) on conflict do nothing;
    return true;
  end if;
  delete from public.story_mutes where user_id=v_user_id and muted_user_id=p_muted_user_id;
  return false;
end;
$$;

create or replace function public.record_story_view(p_story_id uuid)
returns boolean
language plpgsql
security definer
set search_path=''
as $$
declare v_user_id uuid:=auth.uid(); v_owner_id uuid;
begin
  if v_user_id is null then return false; end if;
  select s.user_id into v_owner_id from public.stories s
  join public.profiles p on p.id=s.user_id and not p.is_suspended
  where s.id=p_story_id and s.deleted_at is null and s.expires_at>clock_timestamp();
  if not found or v_owner_id=v_user_id then return false; end if;
  if exists(select 1 from public.user_blocks b where (b.blocker_id=v_user_id and b.blocked_id=v_owner_id) or (b.blocker_id=v_owner_id and b.blocked_id=v_user_id)) then return false; end if;
  insert into public.story_views(story_id,viewer_id) values(p_story_id,v_user_id) on conflict do nothing;
  return found;
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
  if not exists(
    select 1 from public.stories s join public.listings l on l.id=s.linked_listing_id
    join public.profiles p on p.id=s.user_id
    where s.id=p_story_id and s.deleted_at is null and s.expires_at>clock_timestamp()
      and l.status='active' and l.seller_id=s.user_id and not p.is_suspended
  ) then return false; end if;
  insert into public.story_listing_clicks(story_id,user_id) values(p_story_id,v_user_id)
  on conflict(story_id,user_id) where user_id is not null do nothing;
  return true;
end;
$$;

create or replace function public.submit_story_report(
  p_story_id uuid,
  p_reason text,
  p_details text default ''
)
returns uuid
language plpgsql
security definer
set search_path=''
as $$
declare
  v_reporter_id uuid:=auth.uid(); v_owner_id uuid; v_report_id uuid;
  v_details text:=btrim(coalesce(p_details,'')); v_allowed boolean; v_retry_after integer;
begin
  if v_reporter_id is null then raise exception using errcode='P0001',message='not_authenticated'; end if;
  if p_reason not in ('spam','scam','harassment','nudity','prohibited','other') then raise exception using errcode='P0001',message='invalid_report_reason'; end if;
  if char_length(v_details)>2000 then raise exception using errcode='P0001',message='report_details_too_long'; end if;
  select s.user_id into v_owner_id from public.stories s join public.profiles p on p.id=s.user_id and not p.is_suspended where s.id=p_story_id and s.deleted_at is null and s.expires_at>clock_timestamp();
  if not found then raise exception using errcode='P0001',message='story_unavailable'; end if;
  if v_owner_id=v_reporter_id then raise exception using errcode='P0001',message='self_report'; end if;
  select r.allowed,r.retry_after_seconds into v_allowed,v_retry_after from public.consume_action_rate_limit('story_report',3600,10) r;
  if not coalesce(v_allowed,false) then raise exception using errcode='P0001',message='report_rate_limited',hint=greatest(coalesce(v_retry_after,60),1)::text; end if;
  insert into public.story_reports(story_id,reporter_id,story_owner_id,reason,details)
  values(p_story_id,v_reporter_id,v_owner_id,p_reason,v_details)
  on conflict(story_id,reporter_id) do update set reason=excluded.reason,details=excluded.details,status='open',moderation_note=null,reviewed_by=null,reviewed_at=null,created_at=now(),updated_at=now()
  returning id into v_report_id;
  return v_report_id;
end;
$$;

create or replace function public.reply_to_story(
  p_story_id uuid,
  p_body text,
  p_client_request_id uuid
)
returns table(
  chat_id uuid,
  message_id uuid,
  message_body text,
  message_created_at timestamptz
)
language plpgsql
security definer
set search_path=''
as $$
declare
  v_sender_id uuid:=auth.uid(); v_owner_id uuid; v_listing_id uuid; v_listing_valid boolean:=false;
  v_chat_id uuid; v_message_id uuid; v_message_chat_id uuid; v_existing_story_id uuid;
  v_body text:=btrim(coalesce(p_body,'')); v_result_body text; v_created_at timestamptz;
  v_low uuid; v_high uuid; v_allowed boolean; v_retry_after integer;
begin
  if v_sender_id is null then raise exception using errcode='P0001',message='not_authenticated'; end if;
  if p_client_request_id is null then raise exception using errcode='P0001',message='request_id_required'; end if;
  if char_length(v_body)<1 then raise exception using errcode='P0001',message='message_empty'; end if;
  if char_length(v_body)>2000 then raise exception using errcode='P0001',message='message_too_long'; end if;

  select s.user_id,s.linked_listing_id into v_owner_id,v_listing_id
  from public.stories s join public.profiles p on p.id=s.user_id and not p.is_suspended
  where s.id=p_story_id and s.deleted_at is null and s.expires_at>clock_timestamp()
  for update of s;
  if not found then raise exception using errcode='P0001',message='story_unavailable'; end if;
  if v_owner_id=v_sender_id then raise exception using errcode='P0001',message='self_story_reply'; end if;
  if exists(select 1 from public.profiles p where p.id=v_sender_id and p.is_suspended) then raise exception using errcode='P0001',message='account_suspended'; end if;
  if exists(select 1 from public.user_blocks b where (b.blocker_id=v_sender_id and b.blocked_id=v_owner_id) or (b.blocker_id=v_owner_id and b.blocked_id=v_sender_id)) then raise exception using errcode='P0001',message='conversation_blocked'; end if;

  select m.id,m.chat_id,m.body,m.created_at,m.story_id into v_message_id,v_message_chat_id,v_result_body,v_created_at,v_existing_story_id
  from public.messages m where m.sender_id=v_sender_id and m.client_request_id=p_client_request_id;
  if found then
    if v_existing_story_id is distinct from p_story_id then raise exception using errcode='P0001',message='request_id_conflict'; end if;
    return query select v_message_chat_id,v_message_id,v_result_body,v_created_at;
    return;
  end if;

  select exists(select 1 from public.listings l where l.id=v_listing_id and l.seller_id=v_owner_id and l.status='active') into v_listing_valid;
  if v_listing_valid then
    insert into public.chats(listing_id,buyer_id,seller_id,buyer_last_read_at,chat_type)
    values(v_listing_id,v_sender_id,v_owner_id,clock_timestamp(),'listing')
    on conflict(listing_id,buyer_id,seller_id) do nothing returning id into v_chat_id;
    if v_chat_id is null then select c.id into v_chat_id from public.chats c where c.chat_type='listing' and c.listing_id=v_listing_id and c.buyer_id=v_sender_id and c.seller_id=v_owner_id; end if;
  else
    if v_sender_id::text < v_owner_id::text then v_low:=v_sender_id; v_high:=v_owner_id; else v_low:=v_owner_id; v_high:=v_sender_id; end if;
    insert into public.chats(listing_id,buyer_id,seller_id,chat_type)
    values(null,v_low,v_high,'direct')
    on conflict do nothing
    returning id into v_chat_id;
    if v_chat_id is null then select c.id into v_chat_id from public.chats c where c.chat_type='direct' and least(c.buyer_id::text,c.seller_id::text)=v_low::text and greatest(c.buyer_id::text,c.seller_id::text)=v_high::text; end if;
  end if;
  if v_chat_id is null then raise exception using errcode='P0001',message='conversation_create_failed'; end if;

  select r.allowed,r.retry_after_seconds into v_allowed,v_retry_after from public.consume_action_rate_limit('chat_message',60,20) r;
  if not coalesce(v_allowed,false) then raise exception using errcode='P0001',message='message_rate_limited',hint=greatest(coalesce(v_retry_after,60),1)::text; end if;
  insert into public.messages(chat_id,sender_id,body,client_request_id,message_type,story_id)
  values(v_chat_id,v_sender_id,v_body,p_client_request_id,'story_reply',p_story_id)
  on conflict(sender_id,client_request_id) where client_request_id is not null do nothing
  returning id,body,created_at into v_message_id,v_result_body,v_created_at;
  if v_message_id is null then
    select m.id,m.chat_id,m.body,m.created_at into v_message_id,v_message_chat_id,v_result_body,v_created_at
    from public.messages m where m.sender_id=v_sender_id and m.client_request_id=p_client_request_id;
    if v_message_chat_id is distinct from v_chat_id then raise exception using errcode='P0001',message='request_id_conflict'; end if;
  end if;
  update public.chats set
    buyer_archived_at=case when buyer_id=v_sender_id then null else buyer_archived_at end,
    seller_archived_at=case when seller_id=v_sender_id then null else seller_archived_at end
  where id=v_chat_id;
  return query select v_chat_id,v_message_id,v_result_body,v_created_at;
end;
$$;

-- General text messages now support both listing and direct chats.
create or replace function public.send_chat_message(
  p_chat_id uuid,
  p_body text,
  p_client_request_id uuid
)
returns table(message_id uuid,message_body text,message_created_at timestamptz)
language plpgsql security definer set search_path=''
as $$
declare
  v_user_id uuid:=auth.uid(); v_buyer_id uuid; v_seller_id uuid; v_chat_type text; v_listing_status text;
  v_message_id uuid; v_message_chat_id uuid; v_body text:=btrim(coalesce(p_body,'')); v_result_body text; v_created_at timestamptz;
  v_allowed boolean; v_retry_after integer;
begin
  if v_user_id is null then raise exception using errcode='P0001',message='not_authenticated'; end if;
  if char_length(v_body)<1 then raise exception using errcode='P0001',message='message_empty'; end if;
  if char_length(v_body)>2000 then raise exception using errcode='P0001',message='message_too_long'; end if;
  if p_client_request_id is null then raise exception using errcode='P0001',message='request_id_required'; end if;
  select c.buyer_id,c.seller_id,c.chat_type,l.status into v_buyer_id,v_seller_id,v_chat_type,v_listing_status
  from public.chats c left join public.listings l on l.id=c.listing_id
  where c.id=p_chat_id and (c.buyer_id=v_user_id or c.seller_id=v_user_id);
  if not found then raise exception using errcode='P0001',message='conversation_not_found'; end if;
  if v_chat_type='listing' and v_listing_status not in('active','reserved','sold') then raise exception using errcode='P0001',message='conversation_read_only'; end if;
  if v_chat_type not in('listing','direct') then raise exception using errcode='P0001',message='conversation_not_found'; end if;
  if exists(select 1 from public.profiles p where p.id=v_user_id and p.is_suspended) then raise exception using errcode='P0001',message='account_suspended'; end if;
  if exists(select 1 from public.user_blocks b where (b.blocker_id=v_buyer_id and b.blocked_id=v_seller_id) or (b.blocker_id=v_seller_id and b.blocked_id=v_buyer_id)) then raise exception using errcode='P0001',message='conversation_blocked'; end if;
  select m.id,m.chat_id,m.body,m.created_at into v_message_id,v_message_chat_id,v_result_body,v_created_at from public.messages m where m.sender_id=v_user_id and m.client_request_id=p_client_request_id;
  if found then
    if v_message_chat_id is distinct from p_chat_id then raise exception using errcode='P0001',message='request_id_conflict'; end if;
    return query select v_message_id,v_result_body,v_created_at; return;
  end if;
  select r.allowed,r.retry_after_seconds into v_allowed,v_retry_after from public.consume_action_rate_limit('chat_message',60,20) r;
  if not coalesce(v_allowed,false) then raise exception using errcode='P0001',message='message_rate_limited',hint=greatest(coalesce(v_retry_after,60),1)::text; end if;
  insert into public.messages(chat_id,sender_id,body,client_request_id,message_type,story_id)
  values(p_chat_id,v_user_id,v_body,p_client_request_id,'text',null)
  on conflict(sender_id,client_request_id) where client_request_id is not null do nothing
  returning id,body,created_at into v_message_id,v_result_body,v_created_at;
  if v_message_id is null then
    select m.id,m.chat_id,m.body,m.created_at into v_message_id,v_message_chat_id,v_result_body,v_created_at from public.messages m where m.sender_id=v_user_id and m.client_request_id=p_client_request_id;
    if v_message_chat_id is distinct from p_chat_id then raise exception using errcode='P0001',message='request_id_conflict'; end if;
  end if;
  update public.chats set buyer_archived_at=case when buyer_id=v_user_id then null else buyer_archived_at end,seller_archived_at=case when seller_id=v_user_id then null else seller_archived_at end where id=p_chat_id;
  return query select v_message_id,v_result_body,v_created_at;
end;
$$;

-- Blocking removes social follows in both directions immediately.
create or replace function public.set_user_blocked(p_blocked_id uuid,p_blocked boolean)
returns boolean language plpgsql security definer set search_path=''
as $$
declare v_blocker_id uuid:=auth.uid();
begin
  if v_blocker_id is null then raise exception using errcode='P0001',message='not_authenticated'; end if;
  if p_blocked_id is null or p_blocked_id=v_blocker_id then raise exception using errcode='P0001',message='invalid_block_target'; end if;
  if not exists(select 1 from public.profiles p where p.id=p_blocked_id) then raise exception using errcode='P0001',message='user_unavailable'; end if;
  if coalesce(p_blocked,false) then
    insert into public.user_blocks(blocker_id,blocked_id) values(v_blocker_id,p_blocked_id) on conflict(blocker_id,blocked_id) do nothing;
    delete from public.user_follows where (follower_id=v_blocker_id and following_id=p_blocked_id) or (follower_id=p_blocked_id and following_id=v_blocker_id);
    return true;
  end if;
  delete from public.user_blocks where blocker_id=v_blocker_id and blocked_id=p_blocked_id;
  return false;
end;
$$;

drop view public.chat_threads;
create view public.chat_threads with (security_invoker=true) as
select
  c.id,c.listing_id,c.buyer_id,c.seller_id,c.created_at,c.last_message_at,
  c.buyer_last_read_at,c.seller_last_read_at,
  l.slug as listing_slug,l.title as listing_title,l.price,l.currency,l.status as listing_status,
  coalesce(l.cover_image_url,img.image_url) as cover_image_url,
  case when (select auth.uid())=c.buyer_id then c.seller_id else c.buyer_id end as counterparty_id,
  case when (select auth.uid())=c.buyer_id then seller.username else buyer.username end as counterparty_username,
  case when (select auth.uid())=c.buyer_id then seller.full_name else buyer.full_name end as counterparty_full_name,
  case when (select auth.uid())=c.buyer_id then seller.city else buyer.city end as counterparty_city,
  lm.body as last_message_body,lm.sender_id as last_message_sender_id,lm.created_at as last_message_created_at,
  case when (select auth.uid())=c.buyer_id then (
    select count(*)::int from public.messages m where m.chat_id=c.id and m.sender_id<>(select auth.uid()) and m.created_at>coalesce(c.buyer_last_read_at,to_timestamp(0))
  ) else (
    select count(*)::int from public.messages m where m.chat_id=c.id and m.sender_id<>(select auth.uid()) and m.created_at>coalesce(c.seller_last_read_at,to_timestamp(0))
  ) end as unread_count,
  greatest(coalesce(c.last_message_at,c.created_at),c.created_at) as sort_at,
  case when (select auth.uid())=c.buyer_id then c.buyer_archived_at is not null else c.seller_archived_at is not null end as is_archived,
  case when (select auth.uid())=c.buyer_id then seller.avatar_url else buyer.avatar_url end as counterparty_avatar_url,
  c.chat_type
from public.chats c
left join public.listings l on l.id=c.listing_id
left join public.profiles buyer on buyer.id=c.buyer_id
left join public.profiles seller on seller.id=c.seller_id
left join lateral(select li.image_url from public.listing_images li where li.listing_id=l.id order by li.sort_order,li.created_at limit 1) img on true
left join lateral(select m.body,m.sender_id,m.created_at from public.messages m where m.chat_id=c.id order by m.created_at desc,m.id desc limit 1) lm on true
where c.buyer_id=(select auth.uid()) or c.seller_id=(select auth.uid());

revoke all on table public.chat_threads from public,anon,authenticated;
grant select on table public.chat_threads to authenticated;

create view public.admin_story_reports with (security_invoker=true) as
select r.id,r.story_id,r.reporter_id,r.story_owner_id,r.reason,r.details,r.status,
  r.moderation_note,r.reviewed_by,r.reviewed_at,r.created_at,r.updated_at,
  s.media_path,s.media_type,s.caption,s.deleted_at,s.expires_at,
  reporter.username as reporter_username,owner.username as owner_username,
  owner.full_name as owner_full_name,owner.is_suspended as owner_is_suspended
from public.story_reports r
join public.stories s on s.id=r.story_id
left join public.profiles reporter on reporter.id=r.reporter_id
left join public.profiles owner on owner.id=r.story_owner_id;

revoke all on table public.admin_story_reports from public,anon,authenticated;
grant select on table public.admin_story_reports to authenticated;

create or replace function public.review_story_report(
  p_report_id uuid,p_decision text,p_moderation_note text default ''
)
returns text language plpgsql security definer set search_path=''
as $$
declare v_actor_id uuid:=auth.uid(); v_story_id uuid; v_owner_id uuid; v_previous text; v_next text; v_action text; v_note text:=btrim(coalesce(p_moderation_note,''));
begin
  if v_actor_id is null or not public.is_current_user_admin() then raise exception using errcode='P0001',message='not_authorized'; end if;
  if p_decision not in('reviewing','resolved','dismissed','hide_story','suspend_user') then raise exception using errcode='P0001',message='invalid_moderation_decision'; end if;
  if char_length(v_note)>2000 then raise exception using errcode='P0001',message='moderation_note_too_long'; end if;
  select r.story_id,r.story_owner_id,r.status into v_story_id,v_owner_id,v_previous from public.story_reports r where r.id=p_report_id for update;
  if not found then raise exception using errcode='P0001',message='report_not_found'; end if;
  if v_previous not in('open','reviewing') then raise exception using errcode='P0001',message='invalid_report_transition'; end if;
  v_next:=case p_decision when 'reviewing' then 'reviewing' when 'dismissed' then 'dismissed' else 'resolved' end;
  v_action:=case p_decision when 'reviewing' then 'mark_reviewing' when 'resolved' then 'resolve' when 'dismissed' then 'dismiss' else p_decision end;
  update public.story_reports set status=v_next,moderation_note=nullif(v_note,''),reviewed_by=v_actor_id,reviewed_at=now(),updated_at=now() where id=p_report_id;
  if p_decision='hide_story' then update public.stories set deleted_at=coalesce(deleted_at,now()) where id=v_story_id;
  elsif p_decision='suspend_user' then
    update public.profiles set is_suspended=true,updated_at=now() where id=v_owner_id;
    update public.stories set deleted_at=coalesce(deleted_at,now()) where user_id=v_owner_id and deleted_at is null;
    update public.listings set status='archived',updated_at=now() where seller_id=v_owner_id and status in('active','reserved');
  end if;
  insert into public.moderation_audit_log(actor_id,report_kind,report_id,action,target_user_id,metadata)
  values(v_actor_id,'story',p_report_id,v_action,v_owner_id,jsonb_build_object('story_id',v_story_id,'previous_status',v_previous,'next_status',v_next));
  return v_next;
end;
$$;

create or replace function public.get_my_story_stats()
returns table(story_id uuid,view_count bigint,reply_count bigint,listing_click_count bigint)
language sql stable security definer set search_path=''
as $$
  select s.id,
    (select count(*) from public.story_views v where v.story_id=s.id),
    (select count(*) from public.messages m where m.story_id=s.id and m.sender_id<>s.user_id),
    (select count(*) from public.story_listing_clicks c where c.story_id=s.id)
  from public.stories s where s.user_id=auth.uid();
$$;

-- Media cleanup is deliberately not scheduled in v1. This function only
-- identifies eligible paths after the 7-day retention period; a future trusted
-- worker may use the Storage API to delete them.
create or replace function public.list_expired_story_media_for_cleanup(p_limit integer default 100)
returns table(story_id uuid,media_path text)
language sql stable security definer set search_path=''
as $$
  select s.id,s.media_path from public.stories s
  where s.expires_at < now()-interval '7 days'
    and s.media_path is not null
  order by s.expires_at asc
  limit least(greatest(coalesce(p_limit,100),1),500);
$$;

revoke all on function public.set_user_followed(uuid,boolean) from public,anon;
revoke all on function public.create_story(uuid,text,text,text,uuid,integer,integer,integer) from public,anon;
revoke all on function public.delete_own_story(uuid) from public,anon;
revoke all on function public.set_story_muted(uuid,boolean) from public,anon;
revoke all on function public.record_story_view(uuid) from public,anon;
revoke all on function public.record_story_listing_click(uuid) from public,anon;
revoke all on function public.submit_story_report(uuid,text,text) from public,anon;
revoke all on function public.reply_to_story(uuid,text,uuid) from public,anon;
revoke all on function public.review_story_report(uuid,text,text) from public,anon;
revoke all on function public.get_my_story_stats() from public,anon;
revoke all on function public.list_expired_story_media_for_cleanup(integer) from public,anon,authenticated;

grant execute on function public.set_user_followed(uuid,boolean) to authenticated;
grant execute on function public.create_story(uuid,text,text,text,uuid,integer,integer,integer) to authenticated;
grant execute on function public.delete_own_story(uuid) to authenticated;
grant execute on function public.set_story_muted(uuid,boolean) to authenticated;
grant execute on function public.record_story_view(uuid) to authenticated;
grant execute on function public.record_story_listing_click(uuid) to anon,authenticated;
grant execute on function public.submit_story_report(uuid,text,text) to authenticated;
grant execute on function public.reply_to_story(uuid,text,uuid) to authenticated;
grant execute on function public.review_story_report(uuid,text,text) to authenticated;
grant execute on function public.get_my_story_stats() to authenticated;
grant execute on function public.list_expired_story_media_for_cleanup(integer) to service_role;

-- Existing chat RPC grants stay intact; recreate explicit grants defensively.
revoke all on function public.send_chat_message(uuid,text,uuid) from public,anon;
grant execute on function public.send_chat_message(uuid,text,uuid) to authenticated;
