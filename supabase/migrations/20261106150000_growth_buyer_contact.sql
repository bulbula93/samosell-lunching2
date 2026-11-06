-- Buyer contact = the marketplace liquidity KPI: a signed-in buyer starts a listing chat
-- with a real first message. Recorded server-side only (never from the browser), verified
-- against public.chats/messages, deduplicated per chat and forwarded to Meta as "Contact".
-- No message text, chat content or seller identity enters growth_events.
begin;

alter table public.growth_events drop constraint if exists growth_events_event_name_check;
alter table public.growth_events add constraint growth_events_event_name_check check (event_name in (
  'page_view','registration_completed','listing_started','listing_published','listing_edit_completed',
  'listing_publish_failed','boost_checkout_started','boost_purchase_completed','buyer_contact_started'));

create or replace function public.record_growth_outcome(p_event jsonb) returns boolean language plpgsql security invoker set search_path='' as $$
declare v_name text:=p_event->>'event_name'; v_id text:=p_event->>'event_id'; v_user uuid:=(p_event->>'user_id')::uuid;
 v_listing uuid:=(p_event->>'listing_id')::uuid; v_order uuid:=(p_event->>'order_id')::uuid; v_row jsonb; v_kind text; v_context jsonb:=p_event; v_chat uuid;
begin
  if v_name not in ('listing_published','listing_edit_completed','boost_checkout_started','buyer_contact_started') then raise exception 'Unsupported trusted event'; end if;
  if v_name in ('listing_published','listing_edit_completed') then
    select to_jsonb(l) into v_row from public.listings l where l.id=v_listing and l.seller_id=v_user;
    if v_row is null then return false; end if;
    if v_name='listing_published' and (v_row->>'status'<>'active' or v_row->>'published_at' is null or not exists(select 1 from public.listing_images i where i.listing_id=v_listing)) then return false; end if;
    if v_name='listing_published' and v_id<>'listing_published:'||v_listing then raise exception 'Invalid publication key'; end if;
  elsif v_name='buyer_contact_started' then
    if v_id !~ '^buyer_contact_started:[0-9a-fA-F-]{36}$' then raise exception 'Invalid contact key'; end if;
    v_chat:=substr(v_id,23)::uuid;
    -- Only the buyer of a real listing chat who has actually written to the seller counts.
    select jsonb_build_object('listing_id',c.listing_id) into v_row from public.chats c
     where c.id=v_chat and c.chat_type='listing' and c.buyer_id=v_user and c.seller_id<>v_user and c.listing_id=v_listing
       and exists(select 1 from public.messages m where m.chat_id=c.id and m.sender_id=v_user);
    if v_row is null then return false; end if;
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

create or replace function public.claim_growth_meta_events(p_user_id uuid default null,p_limit integer default 20) returns setof public.growth_events language sql security invoker set search_path='' as $$
 update public.growth_events set meta_claimed_at=now(),meta_attempts=meta_attempts+1 where event_id in (
  select e.event_id from public.growth_events e where e.marketing_consent and e.meta_sent_at is null and e.occurred_at>now()-interval '7 days'
  and e.event_name in ('page_view','registration_completed','listing_started','listing_published','boost_checkout_started','boost_purchase_completed','buyer_contact_started')
  and (p_user_id is null or e.user_id=p_user_id) and (e.meta_claimed_at is null or e.meta_claimed_at<now()-interval '5 minutes')
  and not exists(select 1 from public.growth_consent_state c where c.anonymous_id=e.anonymous_id and not c.marketing_consent)
  and not exists(select 1 from public.growth_user_context c where c.user_id=e.user_id and (not c.marketing_consent or c.expires_at<=now()))
  order by e.occurred_at limit least(greatest(p_limit,1),20) for update skip locked
 ) returning *;
$$;
revoke all on function public.claim_growth_meta_events(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_growth_meta_events(uuid,integer) to service_role;

commit;
