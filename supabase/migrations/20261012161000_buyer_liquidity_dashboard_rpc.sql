-- Service-only aggregate for the admin Buyer Liquidity dashboard.
-- Detail events are held for 35 days; calendar boundaries are Asia/Tbilisi.
create or replace function public.get_buyer_liquidity_snapshot(
  p_from timestamptz,
  p_to timestamptz
) returns jsonb
language sql stable security invoker set search_path=''
as $$
with
 e as (
   select listing_id,
     count(*) filter(where event_kind='impression') as impressions,
     count(*) filter(where event_kind='click') as clicks
   from public.catalog_engagement_events
   where occurred_at >= p_from and occurred_at < p_to
   group by listing_id
 ),
 v as (
   select listing_id,count(*) as detail_views
   from public.listing_view_daily
   where created_at >= p_from and created_at < p_to
   group by listing_id
 ),
 metrics as (
   select l.id,l.title,l.slug,l.public_id,
     coalesce(e.impressions,0) as impressions,
     coalesce(e.clicks,0) as clicks,
     coalesce(v.detail_views,0) as detail_views
   from public.listings l
   left join e on e.listing_id=l.id
   left join v on v.listing_id=l.id
   where l.status='active'
 ),
 event_days as (
   select (occurred_at at time zone 'Asia/Tbilisi')::date as day,
     count(*) filter(where event_kind='impression') as impressions,
     count(*) filter(where event_kind='click') as clicks
   from public.catalog_engagement_events
   where occurred_at >= p_from and occurred_at < p_to
   group by 1
 ),
 view_days as (
   select (created_at at time zone 'Asia/Tbilisi')::date as day,
     count(*) as detail_views
   from public.listing_view_daily
   where created_at >= p_from and created_at < p_to
   group by 1
 ),
 daily as (
   select days.day::date as day,coalesce(ed.impressions,0) as impressions,
     coalesce(ed.clicks,0) as clicks,coalesce(vd.detail_views,0) as detail_views
   from generate_series(
     (p_from at time zone 'Asia/Tbilisi')::date,
     (p_to at time zone 'Asia/Tbilisi')::date,
     interval '1 day'
   ) as days(day)
   left join event_days ed on ed.day=days.day
   left join view_days vd on vd.day=days.day
 )
select jsonb_build_object(
 'active_listings',(select count(*) from metrics),
 'impressions',(select coalesce(sum(impressions),0) from metrics),
 'clicks',(select coalesce(sum(clicks),0) from metrics),
 'detail_views',(select coalesce(sum(detail_views),0) from metrics),
 'listings_with_impressions',(select count(*) from metrics where impressions>0),
 'listings_with_views',(select count(*) from metrics where detail_views>0),
 'lifetime_measured_views',(select coalesce(sum(measured_views),0) from public.listing_view_totals),
 'top_listings',coalesce((
    select jsonb_agg(to_jsonb(top))
    from (
      select id,title,slug,public_id,impressions,clicks,detail_views
      from metrics order by impressions desc,clicks desc,detail_views desc,id
      limit 15
    ) top
   ),'[]'::jsonb),
 'daily',coalesce((
    select jsonb_agg(to_jsonb(d) order by day)
    from (select day,impressions,clicks,detail_views from daily) d
   ),'[]'::jsonb)
)
$$;
revoke all on function public.get_buyer_liquidity_snapshot(timestamptz,timestamptz)
  from public,anon,authenticated;
grant execute on function public.get_buyer_liquidity_snapshot(timestamptz,timestamptz)
  to service_role;
