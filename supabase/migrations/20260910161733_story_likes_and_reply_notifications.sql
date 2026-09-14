create table public.story_likes (
  story_id uuid not null references public.stories(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (story_id, user_id)
);
create index story_likes_user_idx on public.story_likes(user_id);
alter table public.story_likes enable row level security;
revoke all on public.story_likes from public, anon, authenticated;
grant select on public.story_likes to authenticated;
grant all on public.story_likes to service_role;

-- A viewer sees only their own like; the author may count their Story's likes.
-- The stories subquery also enforces the existing visibility RLS.
create policy "read own likes or authored Story likes" on public.story_likes
for select to authenticated using (
  exists (select 1 from public.stories s where s.id = story_likes.story_id
    and s.deleted_at is null and s.expires_at > now()
    and (story_likes.user_id = (select auth.uid()) or s.user_id = (select auth.uid())))
);

create function public.set_story_liked(p_story_id uuid, p_liked boolean)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_user uuid := auth.uid(); v_owner uuid; v_hits integer;
begin
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, false) then
    raise exception 'not_authenticated';
  end if;
  if p_liked is null then raise exception 'invalid_like'; end if;
  if not exists(select 1 from public.profiles where id=v_user and not is_suspended) then
    raise exception 'account_suspended';
  end if;
  select s.user_id into v_owner from public.stories s
  join public.profiles p on p.id=s.user_id and not p.is_suspended
  where s.id=p_story_id and s.deleted_at is null and s.expires_at>clock_timestamp()
  for update of s;
  if not found then raise exception 'story_unavailable'; end if;
  if v_owner=v_user then raise exception 'self_story_like'; end if;
  if exists(select 1 from public.user_blocks b where
      (b.blocker_id=v_user and b.blocked_id=v_owner) or (b.blocker_id=v_owner and b.blocked_id=v_user))
    or exists(select 1 from public.story_mutes m where m.user_id=v_user and m.muted_user_id=v_owner) then
    raise exception 'interaction_blocked';
  end if;
  if p_liked = exists(select 1 from public.story_likes l where l.story_id=p_story_id and l.user_id=v_user) then
    return p_liked;
  end if;
  -- A dedicated, fixed quota; callers cannot choose its key or limits.
  insert into public.user_action_rate_limits(user_id,action,window_started_at,hits)
  values(v_user,'story_like',clock_timestamp(),1)
  on conflict(user_id,action) do update set
    window_started_at=case when user_action_rate_limits.window_started_at<=clock_timestamp()-interval '1 minute' then clock_timestamp() else user_action_rate_limits.window_started_at end,
    hits=case when user_action_rate_limits.window_started_at<=clock_timestamp()-interval '1 minute' then 1 else user_action_rate_limits.hits+1 end
  where user_action_rate_limits.hits<60 or user_action_rate_limits.window_started_at<=clock_timestamp()-interval '1 minute'
  returning hits into v_hits;
  if not found then raise exception 'story_like_rate_limited'; end if;
  if p_liked then
    insert into public.story_likes(story_id,user_id) values(p_story_id,v_user) on conflict do nothing;
  else
    delete from public.story_likes where story_id=p_story_id and user_id=v_user;
  end if;
  return p_liked;
end; $$;
revoke all on function public.set_story_liked(uuid,boolean) from public,anon;
grant execute on function public.set_story_liked(uuid,boolean) to authenticated;

create function public.get_story_like_summary(p_story_ids uuid[])
returns table(story_id uuid, liked boolean, like_count bigint)
language sql stable security invoker set search_path='' as $$
  select s.id,coalesce(bool_or(l.user_id=(select auth.uid())),false),
    case when s.user_id=(select auth.uid()) then count(l.user_id) else null end
  from public.stories s left join public.story_likes l on l.story_id=s.id
  where s.id=any(p_story_ids) and cardinality(p_story_ids)<=10
    and s.deleted_at is null and s.expires_at>now()
  group by s.id,s.user_id;
$$;
revoke all on function public.get_story_like_summary(uuid[]) from public,anon;
grant execute on function public.get_story_like_summary(uuid[]) to authenticated;

-- Commit a Story reply and its unread notification together, including direct
-- RPC callers. Replays are deduplicated by the message's existing event key.
create function public.notify_story_reply() returns trigger
language plpgsql security definer set search_path='' as $$
declare v_owner uuid; v_listing uuid; v_sender text;
begin
  select s.user_id,c.listing_id into v_owner,v_listing
  from public.stories s join public.chats c on c.id=new.chat_id
  where s.id=new.story_id and s.user_id<>new.sender_id
    and new.sender_id in (c.buyer_id,c.seller_id) and s.user_id in (c.buyer_id,c.seller_id);
  if not found then return new; end if;
  select coalesce(nullif(full_name,''),username,'მომხმარებელი') into v_sender
  from public.profiles where id=new.sender_id;
  insert into public.notifications(user_id,type,title,body,href,actor_id,listing_id,chat_id,event_key,metadata)
  values(v_owner,'chat_message','Story-ზე ახალი პასუხი',
    left(coalesce(v_sender,'მომხმარებელი')||': '||regexp_replace(new.body,'\s+',' ','g'),180),
    '/dashboard/chats/'||new.chat_id::text,new.sender_id,v_listing,new.chat_id,
    'chat_message:'||new.id::text,jsonb_build_object('message_id',new.id,'story_id',new.story_id,'first_message',false))
  on conflict(event_key) do nothing;
  return new;
end; $$;
revoke all on function public.notify_story_reply() from public,anon,authenticated;
create trigger messages_notify_story_reply after insert on public.messages
for each row when (new.message_type='story_reply' and new.story_id is not null)
execute function public.notify_story_reply();

do $$ begin
  if exists(select 1 from pg_publication where pubname='supabase_realtime')
    and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
