-- Record WHY a listing publish failed (stage + error code), not just that it failed.
-- Only structural, non-personal diagnostics: no titles, descriptions, file names or URLs.
begin;

alter table public.growth_events
  add column if not exists failure jsonb
  check (
    failure is null
    or (jsonb_typeof(failure) = 'object' and pg_column_size(failure) <= 512)
  );

create index if not exists growth_events_publish_failed_idx
  on public.growth_events (occurred_at desc)
  where event_name = 'listing_publish_failed';

create or replace function public.ingest_growth_browser_event(p_event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_user uuid:=(p_event->>'user_id')::uuid; v_anon uuid:=(p_event->>'anonymous_id')::uuid; v_session uuid:=(p_event->>'session_id')::uuid; v_name text:=p_event->>'event_name'; v_marketing boolean:=coalesce((p_event->>'marketing_consent')::boolean,false); v_result jsonb;
  v_failure jsonb:=case when p_event->>'event_name'='listing_publish_failed' and jsonb_typeof(p_event->'failure')='object' and pg_column_size(p_event->'failure')<=512 then p_event->'failure' end;
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
    insert into public.growth_events(event_id,event_name,source,user_id,anonymous_id,session_id,first_touch,last_touch,marketing_consent,path,route_group,device_class,failure)
    values(p_event->>'event_id',v_name,'browser',v_user,v_anon,v_session,coalesce(p_event->'first_touch','{}'),coalesce(p_event->'last_touch','{}'),v_marketing,p_event->>'path',p_event->>'route_group',p_event->>'device_class',v_failure) on conflict do nothing;
  end if;
  select coalesce(jsonb_agg(to_jsonb(e) - 'failure'),'[]') into v_result from (
    select * from public.growth_events where marketing_consent and occurred_at>now()-interval '5 minutes'
    and ((event_id=p_event->>'event_id' and anonymous_id=v_anon) or (user_id=v_user and event_name in ('registration_completed','listing_published','boost_checkout_started','boost_purchase_completed'))) order by occurred_at desc limit 10
  ) e;
  return v_result;
end $$;
revoke all on function public.ingest_growth_browser_event(jsonb) from public,anon,authenticated;
grant execute on function public.ingest_growth_browser_event(jsonb) to service_role;

commit;
