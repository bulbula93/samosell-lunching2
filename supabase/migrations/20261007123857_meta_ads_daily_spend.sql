-- Meta-reported account totals only. Campaign rows never mix with account totals.
create table public.meta_ads_daily_spend (
  date date not null,
  ad_account_id text not null check (ad_account_id = '948841811174019'),
  account_name text not null check (account_name = 'SamoSell Ads'),
  campaign_id text check (campaign_id is null),
  campaign_name text check (campaign_name is null),
  spend_amount numeric(18,6) not null check (spend_amount >= 0),
  spend_currency text not null check (spend_currency = 'USD'),
  spend_gel numeric(18,6),
  fx_rate_to_gel numeric(18,8),
  fx_rate_date date,
  fx_source text,
  impressions bigint check (impressions >= 0),
  clicks bigint check (clicks >= 0),
  synced_at timestamptz not null,
  primary key (ad_account_id, date),
  constraint meta_ads_fx_complete check (
    (spend_gel is null and fx_rate_to_gel is null and fx_rate_date is null and fx_source is null)
    or (spend_gel is not null and spend_gel >= 0 and fx_rate_to_gel is not null and fx_rate_to_gel > 0
      and fx_rate_date is not null and fx_rate_date <= date and fx_rate_date >= date - 7 and fx_source is not null and fx_source = 'NBG'
      and spend_gel = round(spend_amount * fx_rate_to_gel, 6))
  )
);
create table public.meta_ads_sync_state (
  ad_account_id text primary key check (ad_account_id = '948841811174019'),
  run_id uuid,
  lease_until timestamptz,
  last_started_at timestamptz,
  last_success_at timestamptz,
  last_error text check (last_error in ('meta_authorization_failed','meta_api_unavailable','meta_account_mismatch','meta_invalid_report','meta_incomplete_report','meta_storage_unavailable','meta_sync_failed'))
);
alter table public.meta_ads_daily_spend enable row level security;
alter table public.meta_ads_sync_state enable row level security;
revoke all on public.meta_ads_daily_spend, public.meta_ads_sync_state from public, anon, authenticated;
grant select, insert, update, delete on public.meta_ads_daily_spend, public.meta_ads_sync_state to service_role;

create function public.claim_meta_ads_spend_sync(p_run_id uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
begin
  if p_run_id is null then raise exception 'Run required'; end if;
  perform pg_catalog.pg_advisory_xact_lock(948841811174019);
  insert into public.meta_ads_sync_state(ad_account_id) values ('948841811174019') on conflict do nothing;
  if exists (select 1 from public.meta_ads_sync_state where ad_account_id='948841811174019'
    and (lease_until > now() or last_started_at > now() - interval '60 seconds')) then return false; end if;
  update public.meta_ads_sync_state set run_id=p_run_id, lease_until=now()+interval '120 seconds',last_started_at=now()
    where ad_account_id='948841811174019';
  return true;
end $$;

create function public.commit_meta_ads_spend_sync(p_run_id uuid, p_reported_at timestamptz, p_rows jsonb) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare first_day date; last_day date;
begin
  perform pg_catalog.pg_advisory_xact_lock(948841811174019);
  if not exists (select 1 from public.meta_ads_sync_state where ad_account_id='948841811174019' and run_id=p_run_id and lease_until > now())
    then raise exception 'Sync lease unavailable'; end if;
  if p_reported_at is null or p_reported_at > now()+interval '1 minute' or p_reported_at < now()-interval '2 minutes'
    or jsonb_typeof(p_rows) is distinct from 'array' or jsonb_array_length(p_rows) <> 30 then raise exception 'Invalid report'; end if;
  last_day := (p_reported_at at time zone 'Asia/Tbilisi')::date;
  first_day := last_day - 29;
  if (select count(distinct r.date) from jsonb_to_recordset(p_rows) as r(date date)) <> 30
    or exists (select 1 from jsonb_to_recordset(p_rows) as r(date date) where r.date is null or r.date < first_day or r.date > last_day)
    then raise exception 'Incomplete report'; end if;
  insert into public.meta_ads_daily_spend as existing
    (date,ad_account_id,account_name,spend_amount,spend_currency,spend_gel,fx_rate_to_gel,fx_rate_date,fx_source,impressions,clicks,synced_at)
  select r.date,'948841811174019','SamoSell Ads',r.spend_amount,'USD',round(r.spend_amount*r.fx_rate_to_gel,6),r.fx_rate_to_gel,r.fx_rate_date,r.fx_source,r.impressions,r.clicks,p_reported_at
  from jsonb_to_recordset(p_rows) as r(date date,spend_amount numeric,fx_rate_to_gel numeric,fx_rate_date date,fx_source text,impressions bigint,clicks bigint)
  on conflict (ad_account_id,date) do update set
    spend_amount=excluded.spend_amount,
    -- Freeze the first official FX snapshot; corrections to Meta spend use that same rate.
    fx_rate_to_gel=coalesce(existing.fx_rate_to_gel,excluded.fx_rate_to_gel),
    fx_rate_date=coalesce(existing.fx_rate_date,excluded.fx_rate_date),
    fx_source=coalesce(existing.fx_source,excluded.fx_source),
    spend_gel=round(excluded.spend_amount*coalesce(existing.fx_rate_to_gel,excluded.fx_rate_to_gel),6),
    impressions=excluded.impressions,clicks=excluded.clicks,synced_at=excluded.synced_at;
  update public.meta_ads_sync_state set run_id=null,lease_until=null,last_success_at=p_reported_at,last_error=null
    where ad_account_id='948841811174019';
  return true;
end $$;

create function public.fail_meta_ads_spend_sync(p_run_id uuid, p_error text) returns void
language sql security invoker set search_path = '' as $$
  update public.meta_ads_sync_state set run_id=null,lease_until=null,last_error=p_error
    where ad_account_id='948841811174019' and run_id=p_run_id;
$$;
revoke all on function public.claim_meta_ads_spend_sync(uuid),public.commit_meta_ads_spend_sync(uuid,timestamptz,jsonb),public.fail_meta_ads_spend_sync(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_meta_ads_spend_sync(uuid),public.commit_meta_ads_spend_sync(uuid,timestamptz,jsonb),public.fail_meta_ads_spend_sync(uuid,text) to service_role;
