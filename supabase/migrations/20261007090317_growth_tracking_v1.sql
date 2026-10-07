-- Growth Tracking v1. Prepared only; DO NOT apply to Production without owner approval.
-- Service-only telemetry; separate from search, ad and CWV event stores.
begin;
create schema if not exists private;
create table public.growth_events (
  event_id text primary key check (length(event_id) <= 160),
  event_name text not null check (event_name in ('page_view','registration_completed','listing_started','listing_published','listing_edit_completed','listing_publish_failed','boost_checkout_started','boost_purchase_completed')),
  occurred_at timestamptz not null default now(),
  source text not null check (source in ('browser','server','database')),
  user_id uuid references auth.users(id) on delete set null,
  anonymous_id uuid, session_id uuid,
  path text check (length(path)<=180), route_group text, device_class text,
  first_touch jsonb not null default '{}', last_touch jsonb not null default '{}',
  marketing_consent boolean not null default false,
  listing_id uuid, order_id uuid, product_id text, product_type text,
  amount numeric(12,2), currency text check (currency is null or currency='GEL'), payment_provider text,
  meta_sent_at timestamptz, meta_claimed_at timestamptz, meta_attempts integer not null default 0
);
alter table public.growth_events enable row level security;
revoke all on public.growth_events from public, anon, authenticated;
grant select, insert, update, delete on public.growth_events to service_role;
create index growth_events_period_idx on public.growth_events (occurred_at desc, event_name);
create index growth_events_actor_idx on public.growth_events (user_id, event_name, occurred_at) where user_id is not null;
create index growth_events_visitor_idx on public.growth_events (anonymous_id, occurred_at) where anonymous_id is not null;
create index growth_events_listing_idx on public.growth_events (listing_id, event_name) where listing_id is not null;
create index growth_events_meta_pending_idx on public.growth_events (occurred_at) where marketing_consent and meta_sent_at is null;

create table public.growth_user_context (
  user_id uuid primary key references auth.users(id) on delete cascade,
  anonymous_id uuid, session_id uuid, first_touch jsonb not null default '{}', last_touch jsonb not null default '{}',
  marketing_consent boolean not null default false, expires_at timestamptz not null, updated_at timestamptz not null default now()
);
create table public.growth_order_context (
  event_key text primary key, user_id uuid references auth.users(id) on delete cascade,
  anonymous_id uuid, session_id uuid, first_touch jsonb not null default '{}', last_touch jsonb not null default '{}',
  marketing_consent boolean not null default false, created_at timestamptz not null default now()
);
-- Small permanent keys survive raw-event retention and keep late callbacks idempotent.
create table public.growth_consent_state (anonymous_id uuid primary key, marketing_consent boolean not null, decided_at bigint not null);
alter table public.growth_consent_state enable row level security;
revoke all on public.growth_consent_state from public,anon,authenticated;
grant select,insert,update,delete on public.growth_consent_state to service_role;
create table public.growth_conversion_keys (event_id text primary key, created_at timestamptz not null default now());
alter table public.growth_user_context enable row level security;
alter table public.growth_order_context enable row level security;
alter table public.growth_conversion_keys enable row level security;
revoke all on public.growth_user_context,public.growth_order_context,public.growth_conversion_keys from public,anon,authenticated;
grant select,insert,update,delete on public.growth_user_context,public.growth_order_context,public.growth_conversion_keys to service_role;

create function private.capture_growth_registration() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.email_confirmed_at is null or new.is_anonymous is true then return new; end if;
  if tg_op='UPDATE' and old.email_confirmed_at is not null then return new; end if;
  insert into public.growth_conversion_keys(event_id) values ('registration_completed:'||new.id) on conflict do nothing;
  if found then
    insert into public.growth_events(event_id,event_name,user_id,source,occurred_at)
    values ('registration_completed:'||new.id,'registration_completed',new.id,'database',new.email_confirmed_at) on conflict do nothing;
  end if;
  return new;
end $$;
revoke all on function private.capture_growth_registration() from public,anon,authenticated;
create trigger growth_registration_completed after insert or update of email_confirmed_at on auth.users for each row execute function private.capture_growth_registration();

-- Called only by server code after ALL listing/media writes succeed; never on an initial
-- active-row INSERT that might still roll back during image upload.
create function public.record_growth_outcome(p_event jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare v_name text:=p_event->>'event_name'; v_id text:=p_event->>'event_id'; v_user uuid:=(p_event->>'user_id')::uuid;
 v_listing uuid:=(p_event->>'listing_id')::uuid; v_order uuid:=(p_event->>'order_id')::uuid; v_row jsonb; v_kind text; v_context jsonb:=p_event;
begin
  if v_name not in ('listing_published','listing_edit_completed','boost_checkout_started') then raise exception 'Unsupported trusted event'; end if;
  if v_name in ('listing_published','listing_edit_completed') then
    select to_jsonb(l) into v_row from public.listings l where l.id=v_listing and l.seller_id=v_user;
    if v_row is null then return false; end if;
    if v_name='listing_published' and (v_row->>'status'<>'active' or v_row->>'published_at' is null or not exists(select 1 from public.listing_images i where i.listing_id=v_listing)) then return false; end if;
    if v_name='listing_published' and v_id<>'listing_published:'||v_listing then raise exception 'Invalid publication key'; end if;
  else
    v_kind:=case when p_event->>'product_type'='banner' then 'banner' else 'boost' end;
    if v_kind='banner' then select to_jsonb(o) into v_row from public.ad_orders o where o.id=v_order and o.user_id=v_user;
    else select to_jsonb(o) into v_row from public.listing_boost_orders o where o.id=v_order and o.seller_id=v_user; end if;
    if v_row is null or v_row->>'provider_payment_id' is null then return false; end if;
    if v_id<>'boost_checkout_started:'||v_kind||':'||v_order then raise exception 'Invalid checkout key'; end if;
    if v_kind='boost' and v_row->>'payment_provider'='flitt' and not exists(select 1 from public.flitt_payment_attempts a where a.boost_order_id=v_order and a.mode='live') then return false; end if;
    if v_kind='banner' and not exists(select 1 from public.flitt_payment_attempts a where a.ad_order_id=v_order and a.mode='live') then return false; end if;
    insert into public.growth_order_context(event_key,user_id,anonymous_id,session_id,first_touch,last_touch,marketing_consent)
    values (v_kind||':'||v_order,v_user,(p_event->>'anonymous_id')::uuid,(p_event->>'session_id')::uuid,coalesce(p_event->'first_touch','{}'),coalesce(p_event->'last_touch','{}'),coalesce((p_event->>'marketing_consent')::boolean,false)) on conflict do nothing;
  end if;
  insert into public.growth_conversion_keys(event_id) values(v_id) on conflict do nothing;
  if not found then return true; end if;
  if p_event->>'anonymous_id' is null then
    -- Without current analytics consent, keep only operational outcomes.
    v_context:='{}'::jsonb;
  end if;
  insert into public.growth_events(event_id,event_name,source,user_id,anonymous_id,session_id,first_touch,last_touch,marketing_consent,listing_id,order_id,product_id,product_type,amount,currency,payment_provider,path,route_group)
  values(v_id,v_name,'server',v_user,(v_context->>'anonymous_id')::uuid,(v_context->>'session_id')::uuid,coalesce(v_context->'first_touch','{}'),coalesce(v_context->'last_touch','{}'),coalesce((v_context->>'marketing_consent')::boolean,false),coalesce(v_listing,(v_row->>'listing_id')::uuid),v_order,v_row->>'product_id',case when v_kind='banner' then 'banner' else coalesce(v_row->>'placement_snapshot',v_row->>'product_id') end,(case when v_name='boost_checkout_started' then (v_row->>'amount')::numeric end),case when v_name='boost_checkout_started' then 'GEL' end,v_row->>'payment_provider',p_event->>'path',p_event->>'route_group') on conflict do nothing;
  return true;
end $$;
revoke all on function public.record_growth_outcome(jsonb) from public,anon,authenticated;
grant execute on function public.record_growth_outcome(jsonb) to service_role;

create function private.capture_growth_purchase() returns trigger language plpgsql security definer set search_path='' as $$
declare v_row jsonb:=to_jsonb(new); v_kind text:=case when tg_table_name='ad_orders' then 'banner' else 'boost' end;
 v_user uuid:=coalesce(v_row->>'seller_id',v_row->>'user_id')::uuid; v_key text:=v_kind||':'||(v_row->>'id'); v_ctx public.growth_order_context%rowtype; v_allowed boolean:=false;
begin
  if v_row->>'paid_at' is null or v_row->>'currency' is distinct from 'GEL' or coalesce((v_row->>'amount')::numeric,0)<=0 then return new; end if;
  if v_row->>'payment_provider'='tbc_checkout' and v_row->>'provider_status'='Succeeded' and v_row->>'provider_payment_id' is not null then v_allowed:=true;
  elsif v_row->>'payment_provider'='flitt' and v_row->>'provider_status'='approved' then
    select exists(select 1 from public.flitt_payment_attempts a where
      ((v_kind='boost' and a.boost_order_id=(v_row->>'id')::uuid and a.purpose='boost_order') or (v_kind='banner' and a.ad_order_id=(v_row->>'id')::uuid and a.purpose='ad_order'))
      and a.mode='live' and a.status='approved' and a.provider_status='approved' and a.response_status='success'
      and a.provider_verified_at is not null and a.provider_verification_source='status_api'
      and a.provider_payment_id=v_row->>'provider_payment_id' and a.user_id=v_user and a.currency='GEL' and a.amount=round((v_row->>'amount')::numeric*100)::integer) into v_allowed;
  end if;
  if not v_allowed or (v_kind='boost' and v_row->>'status' not in ('active','expired','under_review','approved')) or (v_kind='banner' and v_row->>'status' not in ('paid_pending_review','active','scheduled','expired')) then return new; end if;
  insert into public.growth_conversion_keys(event_id) values('boost_purchase_completed:'||v_key) on conflict do nothing;
  if not found then return new; end if;
  select * into v_ctx from public.growth_order_context where event_key=v_key;
  insert into public.growth_events(event_id,event_name,source,occurred_at,user_id,anonymous_id,session_id,first_touch,last_touch,marketing_consent,listing_id,order_id,product_id,product_type,amount,currency,payment_provider,path,route_group)
  values('boost_purchase_completed:'||v_key,'boost_purchase_completed','database',(v_row->>'paid_at')::timestamptz,v_user,v_ctx.anonymous_id,v_ctx.session_id,coalesce(v_ctx.first_touch,'{}'),coalesce(v_ctx.last_touch,'{}'),coalesce(v_ctx.marketing_consent,false) and not exists(select 1 from public.growth_user_context c where c.user_id=v_user and not c.marketing_consent),(v_row->>'listing_id')::uuid,(v_row->>'id')::uuid,v_row->>'product_id',case when v_kind='banner' then 'banner' else coalesce(v_row->>'placement_snapshot',v_row->>'product_id') end,(v_row->>'amount')::numeric,'GEL',v_row->>'payment_provider','/dashboard/billing','checkout') on conflict do nothing;
  return new;
end $$;
revoke all on function private.capture_growth_purchase() from public,anon,authenticated;
create trigger growth_boost_purchase after insert or update of paid_at,provider_status,status on public.listing_boost_orders for each row execute function private.capture_growth_purchase();
create trigger growth_banner_purchase after insert or update of paid_at,provider_status,status on public.ad_orders for each row execute function private.capture_growth_purchase();

create function public.ingest_growth_browser_event(p_event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_user uuid:=(p_event->>'user_id')::uuid; v_anon uuid:=(p_event->>'anonymous_id')::uuid; v_session uuid:=(p_event->>'session_id')::uuid; v_name text:=p_event->>'event_name'; v_marketing boolean:=coalesce((p_event->>'marketing_consent')::boolean,false); v_result jsonb;
begin
  if v_name not in ('page_view','listing_started','listing_publish_failed','identify') then raise exception 'Untrusted event'; end if;
  if v_name in ('listing_started','listing_publish_failed') and v_user is null then raise exception 'User required'; end if;
  -- Serialize public visitor ingestion, bounded to 120 events per visitor / 10 min.
  perform pg_advisory_xact_lock(hashtext(v_anon::text));
  if (select count(*) from public.growth_events where anonymous_id=v_anon and source='browser' and occurred_at>now()-interval '10 minutes')>=120 then raise exception 'Rate limit'; end if;
  insert into public.growth_consent_state(anonymous_id,marketing_consent,decided_at) values(v_anon,v_marketing,(p_event->>'consent_updated_at')::bigint)
  on conflict(anonymous_id) do update set marketing_consent=excluded.marketing_consent,decided_at=excluded.decided_at where growth_consent_state.decided_at<=excluded.decided_at;
  if exists(select 1 from public.growth_consent_state where anonymous_id=v_anon and decided_at>(p_event->>'consent_updated_at')::bigint) then return '[]'::jsonb; end if;
  if v_user is not null then
    insert into public.growth_user_context(user_id,anonymous_id,session_id,first_touch,last_touch,marketing_consent,expires_at)
    values(v_user,v_anon,v_session,coalesce(p_event->'first_touch','{}'),coalesce(p_event->'last_touch','{}'),v_marketing,to_timestamp((p_event->>'expires_at')::numeric/1000))
    on conflict(user_id) do update set anonymous_id=excluded.anonymous_id,session_id=excluded.session_id,
      first_touch=case when growth_user_context.expires_at<=now() then excluded.first_touch else growth_user_context.first_touch end,
      last_touch=excluded.last_touch,marketing_consent=excluded.marketing_consent,expires_at=excluded.expires_at,updated_at=now();
    -- The auth trigger is authoritative. Attribution merely enriches its existing event once.
    update public.growth_events set anonymous_id=v_anon,session_id=v_session,first_touch=coalesce(p_event->'first_touch','{}'),last_touch=coalesce(p_event->'last_touch','{}'),marketing_consent=v_marketing,path='/register',route_group='auth'
    where event_id='registration_completed:'||v_user and anonymous_id is null and occurred_at>now()-interval '30 days';
  end if;
  if v_name<>'identify' then
    insert into public.growth_events(event_id,event_name,source,user_id,anonymous_id,session_id,first_touch,last_touch,marketing_consent,path,route_group,device_class)
    values(p_event->>'event_id',v_name,'browser',v_user,v_anon,v_session,coalesce(p_event->'first_touch','{}'),coalesce(p_event->'last_touch','{}'),v_marketing,p_event->>'path',p_event->>'route_group',p_event->>'device_class') on conflict do nothing;
  end if;
  select coalesce(jsonb_agg(to_jsonb(e)),'[]') into v_result from (
    select * from public.growth_events where marketing_consent and occurred_at>now()-interval '5 minutes'
    and (event_id=p_event->>'event_id' or (user_id=v_user and event_name in ('registration_completed','listing_published','boost_checkout_started','boost_purchase_completed'))) order by occurred_at desc limit 10
  ) e;
  return v_result;
end $$;
revoke all on function public.ingest_growth_browser_event(jsonb) from public,anon,authenticated;
grant execute on function public.ingest_growth_browser_event(jsonb) to service_role;

create function public.revoke_growth_consent(p_user_id uuid,p_anonymous_id uuid,p_decided_at bigint) returns void language sql security invoker set search_path='' as $$
 insert into public.growth_consent_state(anonymous_id,marketing_consent,decided_at) select p_anonymous_id,false,p_decided_at where p_anonymous_id is not null on conflict(anonymous_id) do update set marketing_consent=false,decided_at=excluded.decided_at where growth_consent_state.decided_at<=excluded.decided_at;
 update public.growth_user_context set marketing_consent=false,anonymous_id=null,session_id=null,first_touch='{}',last_touch='{}',expires_at=now(),updated_at=now() where user_id=p_user_id;
 update public.growth_order_context set marketing_consent=false,anonymous_id=null,session_id=null,first_touch='{}',last_touch='{}' where user_id=p_user_id;
 update public.growth_events set marketing_consent=false where (user_id=p_user_id or anonymous_id=p_anonymous_id) and meta_sent_at is null;
$$;
revoke all on function public.revoke_growth_consent(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.revoke_growth_consent(uuid,uuid,bigint) to service_role;

create function public.claim_growth_meta_events(p_user_id uuid default null,p_limit integer default 20) returns setof public.growth_events language sql security invoker set search_path='' as $$
 update public.growth_events set meta_claimed_at=now(),meta_attempts=meta_attempts+1 where event_id in (
  select e.event_id from public.growth_events e where e.marketing_consent and e.meta_sent_at is null and e.occurred_at>now()-interval '7 days'
  and e.event_name in ('page_view','registration_completed','listing_started','listing_published','boost_checkout_started','boost_purchase_completed')
  and (p_user_id is null or e.user_id=p_user_id) and (e.meta_claimed_at is null or e.meta_claimed_at<now()-interval '5 minutes')
  and not exists(select 1 from public.growth_consent_state c where c.anonymous_id=e.anonymous_id and not c.marketing_consent)
  and not exists(select 1 from public.growth_user_context c where c.user_id=e.user_id and (not c.marketing_consent or c.expires_at<=now()))
  order by e.occurred_at limit least(greatest(p_limit,1),20) for update skip locked
 ) returning *;
$$;
revoke all on function public.claim_growth_meta_events(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_growth_meta_events(uuid,integer) to service_role;

-- Retention is bounded and opt-in; deploy a maintenance job only after approval.
create function public.prune_growth_events(p_limit integer default 5000) returns integer language plpgsql security invoker set search_path='' as $$
declare v_count integer;
begin
 delete from public.growth_events where event_id in (select event_id from public.growth_events where occurred_at<now()-case when source='browser' then interval '90 days' else interval '365 days' end limit least(greatest(p_limit,1),5000));
 get diagnostics v_count=row_count;
 delete from public.growth_user_context where expires_at<now()-interval '7 days';
 delete from public.growth_order_context where created_at<now()-interval '365 days';
 return v_count;
end $$;
revoke all on function public.prune_growth_events(integer) from public,anon,authenticated;
grant execute on function public.prune_growth_events(integer) to service_role;
create function public.get_growth_summary(p_actor_id uuid,p_from timestamptz,p_to timestamptz) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_result jsonb;
begin
 if not exists(select 1 from public.profiles where id=p_actor_id and is_admin) then raise exception 'Admin required' using errcode='42501'; end if;
 if p_to<=p_from or p_to-p_from>interval '31 days' then raise exception 'Invalid range'; end if;
 with e as materialized (select * from public.growth_events where occurred_at>=p_from and occurred_at<p_to),
 visitors as (select anonymous_id,min(occurred_at) at from e where event_name='page_view' and anonymous_id is not null group by anonymous_id),
 registered as (select r.user_id,r.anonymous_id,min(r.occurred_at) at from e r join visitors v on v.anonymous_id=r.anonymous_id and r.occurred_at>=v.at where r.event_name='registration_completed' group by r.user_id,r.anonymous_id),
 started as (select r.user_id,r.anonymous_id,min(s.occurred_at) at from registered r join e s on s.user_id=r.user_id and s.event_name='listing_started' and s.occurred_at>=r.at group by r.user_id,r.anonymous_id),
 published as (select s.user_id,s.anonymous_id,min(l.occurred_at) at from started s join e l on l.user_id=s.user_id and l.event_name='listing_published' and l.occurred_at>=s.at group by s.user_id,s.anonymous_id),
 paying as (select distinct p.user_id,p.anonymous_id from published p join e b on b.user_id=p.user_id and b.event_name='boost_purchase_completed' and b.product_type<>'banner' and b.occurred_at>=p.at join e l on l.listing_id=b.listing_id and l.event_name='listing_published' and l.user_id=p.user_id and l.occurred_at>=p.at and l.occurred_at<=b.occurred_at),
 source_groups as (select coalesce(nullif(first_touch->>'utm_source',''),'direct / unknown') label,count(distinct anonymous_id) visitors,count(*) page_views from e where event_name='page_view' group by 1),
 campaign_groups as (select coalesce(nullif(first_touch->>'utm_campaign',''),'unattributed') label,count(distinct anonymous_id) visitors,count(*) page_views from e where event_name='page_view' group by 1),
 reg_cohort as (select user_id,min(occurred_at) at from e where event_name='registration_completed' group by user_id),
 reg_publish as (select distinct r.user_id from reg_cohort r join e l on l.user_id=r.user_id and l.event_name='listing_published' and l.occurred_at>=r.at),
 new_sellers as (select distinct l.user_id from e l where l.event_name='listing_published' and not exists(select 1 from public.growth_events old where old.user_id=l.user_id and old.event_name='listing_published' and old.occurred_at<p_from) and not exists(select 1 from public.listings old where old.seller_id=l.user_id and old.published_at<p_from)),
 counts as (select count(distinct anonymous_id) filter(where event_name='page_view') visitors,count(distinct session_id) filter(where event_name='page_view') sessions,count(*) filter(where event_name='page_view') page_views,
 count(*) filter(where event_name='registration_completed') registrations,count(*) filter(where event_name='listing_started') listing_starts,count(*) filter(where event_name='listing_published') published_listings,count(distinct user_id) filter(where event_name='listing_published') sellers,
 count(*) filter(where event_name='boost_purchase_completed') purchases,coalesce(sum(amount) filter(where event_name='boost_purchase_completed'),0) revenue,count(distinct user_id) filter(where event_name='boost_purchase_completed') paying_sellers,
 count(*) filter(where event_name='boost_purchase_completed' and product_type='banner') banner_purchases,
 count(*) filter(where event_name='listing_publish_failed') publish_failures,
 count(distinct listing_id) filter(where event_name='boost_purchase_completed' and listing_id in(select listing_id from e where event_name='listing_published')) boosted_published_listings from e)
 select jsonb_build_object('counts',(select to_jsonb(c) from counts c),'funnel',jsonb_build_array((select count(*) from visitors),(select count(distinct anonymous_id) from registered),(select count(distinct anonymous_id) from started),(select count(distinct anonymous_id) from published),(select count(distinct anonymous_id) from paying)),
 'sources',coalesce((select jsonb_agg(to_jsonb(s)) from (select * from source_groups order by visitors desc,label limit 30) s),'[]'),
 'campaigns',coalesce((select jsonb_agg(to_jsonb(c)) from (select * from campaign_groups order by visitors desc,label limit 30) c),'[]'),
 'new_sellers',(select count(*) from new_sellers),'registered_publishers',(select count(*) from reg_publish),
 'favorites_added',(select count(*) from public.favorites where created_at>=p_from and created_at<p_to),
 'chats_initiated',(select count(*) from public.chat_threads where created_at>=p_from and created_at<p_to and chat_type is distinct from 'support'),
 'coverage_since',(select min(occurred_at) from public.growth_events)) into v_result;
 return v_result;
end $$;
revoke all on function public.get_growth_summary(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.get_growth_summary(uuid,timestamptz,timestamptz) to service_role;
commit;
