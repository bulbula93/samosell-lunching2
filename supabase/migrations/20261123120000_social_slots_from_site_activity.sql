-- Social Media Agent OS: posting slots moved to SamoSell's busiest hours (Tbilisi time).
-- Mon 21:00 · Thu 21:00 · Fri 15:00 · Sat 15:00 · Sun 21:00 (Stories +60 min).
-- In UTC (Tbilisi = UTC+4, no DST): 17:00 / 11:00 feed, 18:00 / 12:00 Stories.
-- 1) The publish tick runs 5 minutes after each of those UTC hours.
-- 2) Plan drafts that are not approved yet (status draft / qa_failed / ready_for_review) move to the
--    new slot of the same pillar in the same week. Wednesday's how_to_sell moves to Thursday, so its
--    plan key changes from :2: to :3:. Only scheduled_for and idempotency_key change: content,
--    version, QA result and pending approvals stay valid (the version guard ignores both columns).
--    Approved, queued or published posts are never touched.

select cron.unschedule(jobid) from cron.job where jobname = 'samosell-social-publish-tick';
select cron.schedule(
  'samosell-social-publish-tick',
  '5 11,12,17,18 * * *',
  $job$
    select net.http_get(
      url := 'https://samosell.ge/api/internal/social/tick',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'samosell_social_cron_secret')
      ),
      timeout_milliseconds := 60000
    );
  $job$
);

with slot(old_offset, new_offset, pillar, hour_utc) as (
  values (0, 0, 'featured_listing', 17), (2, 3, 'how_to_sell', 17), (4, 4, 'giveaway', 11),
         (5, 5, 'category_roundup', 11), (6, 6, 'trust', 17)
), target as (
  select p.id,
         (split_part(p.idempotency_key, ':', 2))::date as week_start,
         s.new_offset, s.pillar, s.hour_utc,
         p.idempotency_key like '%:story' as is_story
    from public.social_posts p
    join slot s on split_part(p.idempotency_key, ':', 3) = s.old_offset::text
               and split_part(p.idempotency_key, ':', 4) = s.pillar
   where p.idempotency_key ~ '^plan:\d{4}-\d{2}-\d{2}:\d:[a-z_]+(:story)?$'
     and p.status in ('draft', 'qa_failed', 'ready_for_review')
     and split_part(p.idempotency_key, ':', 2)::date >= date '2026-11-23'
)
update public.social_posts p
   set scheduled_for = ((t.week_start + t.new_offset) + make_interval(hours => t.hour_utc + case when t.is_story then 1 else 0 end)) at time zone 'UTC',
       idempotency_key = 'plan:' || to_char(t.week_start, 'YYYY-MM-DD') || ':' || t.new_offset || ':' || t.pillar || case when t.is_story then ':story' else '' end,
       updated_at = clock_timestamp()
  from target t
 where p.id = t.id;
