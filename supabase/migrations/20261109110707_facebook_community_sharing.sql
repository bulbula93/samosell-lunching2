-- Prepared for review. Do not apply to Production without explicit owner approval.
begin;

-- Public, non-secret community destination. NULL intentionally means unconfigured.
create table public.community_settings (
  singleton boolean primary key default true check (singleton),
  facebook_group_url text check (facebook_group_url is null or (
    length(facebook_group_url) <= 250 and facebook_group_url ~ '^https://www[.]facebook[.]com/groups/[A-Za-z0-9._-]{1,200}/$'
  ))
);
insert into public.community_settings(singleton, facebook_group_url) values(true, null);
alter table public.community_settings enable row level security;
revoke all on public.community_settings from public, anon, authenticated;
grant select on public.community_settings to anon, authenticated, service_role;
grant update (facebook_group_url) on public.community_settings to authenticated;
create policy community_settings_public_read on public.community_settings for select to anon, authenticated using (true);
create policy community_settings_admin_update on public.community_settings for update to authenticated
  using ((select public.is_current_user_admin())) with check ((select public.is_current_user_admin()));

alter table public.growth_events drop constraint growth_events_event_name_check;
alter table public.growth_events add constraint growth_events_event_name_check check (event_name in (
  'page_view','registration_completed','listing_started','listing_published','listing_edit_completed',
  'listing_publish_failed','boost_checkout_started','boost_purchase_completed','buyer_contact_started','listing_share_action'));
alter table public.growth_events add column share_action text check (share_action is null or share_action in (
  'facebook_share_clicked','post_copied','link_copied','group_open_clicked'));
alter table public.growth_events add constraint growth_events_share_event_shape_check check (
  (event_name = 'listing_share_action' and share_action is not null and listing_id is not null and source = 'browser' and not marketing_consent)
  or (event_name <> 'listing_share_action' and share_action is null)
);

create or replace function public.ingest_growth_browser_event(p_event jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_user uuid:=(p_event->>'user_id')::uuid; v_anon uuid:=(p_event->>'anonymous_id')::uuid; v_session uuid:=(p_event->>'session_id')::uuid; v_name text:=p_event->>'event_name'; v_marketing boolean:=coalesce((p_event->>'marketing_consent')::boolean,false); v_result jsonb;
  v_failure jsonb:=case when p_event->>'event_name'='listing_publish_failed' and jsonb_typeof(p_event->'failure')='object' and pg_column_size(p_event->'failure')<=512 then p_event->'failure' end;
begin
  if v_name not in ('page_view','listing_started','listing_publish_failed','identify','listing_share_action') then raise exception 'Untrusted event'; end if;
  if v_name in ('listing_started','listing_publish_failed') and v_user is null then raise exception 'User required'; end if;
  -- Browser intent only. Validate the active public listing and bounded action.
  if v_name='listing_share_action' then
    if p_event->>'share_action' is null or p_event->>'share_action' not in ('facebook_share_clicked','post_copied','link_copied','group_open_clicked')
      or not exists(select 1 from public.listings where id=(p_event->>'listing_id')::uuid and status='active') then
      raise exception 'Invalid share action';
    end if;
    -- Never forward sharing intent to Meta as a conversion.
    v_marketing:=false;
  end if;
  -- Serialize public visitor ingestion, bounded to 120 events per visitor / 10 min.
  perform pg_advisory_xact_lock(hashtext(v_anon::text));
  if (select count(*) from public.growth_events where anonymous_id=v_anon and source='browser' and occurred_at>now()-interval '10 minutes')>=120 then raise exception 'Rate limit'; end if;
  insert into public.growth_consent_state(anonymous_id,marketing_consent,decided_at) values(v_anon,coalesce((p_event->>'marketing_consent')::boolean,false),(p_event->>'consent_updated_at')::bigint)
  on conflict(anonymous_id) do update set marketing_consent=excluded.marketing_consent,decided_at=excluded.decided_at where growth_consent_state.decided_at<=excluded.decided_at;
  if exists(select 1 from public.growth_consent_state where anonymous_id=v_anon and decided_at>(p_event->>'consent_updated_at')::bigint) then return '[]'::jsonb; end if;
  if v_user is not null and v_name<>'listing_share_action' then
    insert into public.growth_user_context(user_id,anonymous_id,session_id,first_touch,last_touch,marketing_consent,expires_at)
    values(v_user,v_anon,v_session,coalesce(p_event->'first_touch','{}'),coalesce(p_event->'last_touch','{}'),coalesce((p_event->>'marketing_consent')::boolean,false),to_timestamp((p_event->>'expires_at')::numeric/1000))
    on conflict(user_id) do update set anonymous_id=excluded.anonymous_id,session_id=excluded.session_id,
      first_touch=case when growth_user_context.expires_at<=now() then excluded.first_touch else growth_user_context.first_touch end,
      last_touch=excluded.last_touch,marketing_consent=excluded.marketing_consent,expires_at=excluded.expires_at,updated_at=now();
    -- The auth trigger is authoritative. Attribution merely enriches its existing event once.
    update public.growth_events set anonymous_id=v_anon,session_id=v_session,first_touch=coalesce(p_event->'first_touch','{}'),last_touch=coalesce(p_event->'last_touch','{}'),marketing_consent=v_marketing,path='/register',route_group='auth'
    where event_id='registration_completed:'||v_user and anonymous_id is null and occurred_at>now()-interval '30 days';
  end if;
  if v_name<>'identify' then
    insert into public.growth_events(event_id,event_name,source,user_id,anonymous_id,session_id,first_touch,last_touch,marketing_consent,path,route_group,device_class,failure,listing_id,share_action)
    values(p_event->>'event_id',v_name,'browser',v_user,v_anon,v_session,coalesce(p_event->'first_touch','{}'),coalesce(p_event->'last_touch','{}'),v_marketing,p_event->>'path',p_event->>'route_group',p_event->>'device_class',v_failure,case when v_name='listing_share_action' then (p_event->>'listing_id')::uuid end,case when v_name='listing_share_action' then p_event->>'share_action' end) on conflict do nothing;
  end if;
  if v_name='listing_share_action' then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(to_jsonb(e) - 'failure'),'[]') into v_result from (
    select * from public.growth_events where marketing_consent and occurred_at>now()-interval '5 minutes'
    and ((event_id=p_event->>'event_id' and anonymous_id=v_anon) or (user_id=v_user and event_name in ('registration_completed','listing_published','boost_checkout_started','boost_purchase_completed'))) order by occurred_at desc limit 10
  ) e;
  return v_result;
end $$;
revoke all on function public.ingest_growth_browser_event(jsonb) from public,anon,authenticated;
grant execute on function public.ingest_growth_browser_event(jsonb) to service_role;


create function public.get_listing_share_summary(p_actor_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and is_admin) then raise exception 'Admin required'; end if;
  if p_from is null or p_to is null or p_to < p_from or p_to-p_from > interval '31 days' then raise exception 'Invalid period'; end if;
  select coalesce(jsonb_object_agg(share_action, n), '{}') into result from (
    select share_action, count(*) n from public.growth_events
    where event_name='listing_share_action' and occurred_at>=p_from and occurred_at<p_to group by share_action
  ) actions;
  return result;
end $$;
revoke all on function public.get_listing_share_summary(uuid,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.get_listing_share_summary(uuid,timestamptz,timestamptz) to service_role;

commit;
