-- Social Media Agent OS: resolve "needs_review" jobs safely + weekly auto-planning.
--
-- 1) social_resolve_review_job: the only way out of needs_review. Called by the worker after it has
--    checked the Instagram container on Meta (PUBLISHED / FINISHED / EXPIRED …) or by an admin action.
--    Server-only (service_role). Never touches jobs in any other status.
-- 2) social_refresh_post_status: cancelled jobs no longer keep a post stuck in "publishing".
-- 3) pg_cron: the publish tick may now run up to 60 s (Instagram carousels need more than 30 s), and a
--    weekly planning call creates next week's drafts every Thursday. Drafts still need admin approval
--    unless organic auto-publish is enabled; kill switch / dry-run are enforced server-side.
-- Prerequisite (already present): vault secret 'samosell_social_cron_secret' = Vercel CRON_SECRET.

create or replace function public.social_resolve_review_job(p_job_id uuid, p_resolution text, p_external_post_id text default null)
returns text language plpgsql set search_path = '' as $$
declare j record; next_status text;
begin
  if p_resolution not in ('published', 'requeue_resume', 'requeue_fresh', 'cancel', 'dead_letter') then
    raise exception 'invalid_resolution' using errcode = 'P0001';
  end if;
  select * into j from public.social_publish_jobs where id = p_job_id for update;
  if not found then raise exception 'job_not_found' using errcode = 'P0001'; end if;
  if j.status <> 'needs_review' then raise exception 'job_not_in_review' using errcode = 'P0001'; end if;
  if p_resolution = 'published' and (p_external_post_id is null or char_length(p_external_post_id) not between 1 and 200) then
    raise exception 'external_post_id_required' using errcode = 'P0001';
  end if;
  if p_resolution = 'requeue_resume' and j.external_container_id is null then
    raise exception 'container_missing' using errcode = 'P0001';
  end if;

  next_status := case p_resolution
    when 'published' then 'published'
    when 'cancel' then 'cancelled'
    when 'dead_letter' then 'dead_letter'
    else 'queued' end;

  update public.social_publish_jobs set
    status = next_status,
    external_post_id = case when p_resolution = 'published' then p_external_post_id else external_post_id end,
    external_container_id = case when p_resolution = 'requeue_fresh' then null else external_container_id end,
    -- A requeue always gets one more attempt: the lease expired because of our timeout, not Meta.
    attempt = case when next_status = 'queued' then least(attempt, max_attempts - 1) else attempt end,
    scheduled_at = case when next_status = 'queued' then clock_timestamp() else scheduled_at end,
    last_error_code = case when next_status = 'published' then null else 'review_' || p_resolution end,
    lease_token = null, leased_until = null, updated_at = clock_timestamp()
   where id = j.id;
  perform public.social_refresh_post_status(j.post_id);
  return next_status;
end $$;

create or replace function public.social_refresh_post_status(p_post_id uuid)
returns void language plpgsql set search_path = '' as $$
declare total integer; done integer; bad integer; cancelled integer;
begin
  select count(*) filter (where status <> 'cancelled'),
         count(*) filter (where status in ('published', 'dry_run_completed')),
         count(*) filter (where status in ('dead_letter', 'needs_review', 'failed')),
         count(*) filter (where status = 'cancelled')
    into total, done, bad, cancelled from public.social_publish_jobs where post_id = p_post_id;
  update public.social_posts set status = case
      when total = 0 and cancelled > 0 then 'cancelled'
      when total > 0 and done = total then 'published'
      when done > 0 and bad > 0 then 'partially_published'
      when bad > 0 and done = 0 then 'failed'
      else 'publishing' end
   where id = p_post_id and status in ('scheduled', 'publishing', 'partially_published', 'failed');
end $$;

revoke all on function public.social_resolve_review_job(uuid, text, text) from public, anon, authenticated;
revoke all on function public.social_refresh_post_status(uuid) from public, anon, authenticated;
grant execute on function public.social_resolve_review_job(uuid, text, text) to service_role;
grant execute on function public.social_refresh_post_status(uuid) to service_role;

-- Publish tick: same schedule, longer HTTP timeout to match the route's 60 s maxDuration.
select cron.unschedule(jobid) from cron.job where jobname = 'samosell-social-publish-tick';
select cron.schedule(
  'samosell-social-publish-tick',
  '5 8,14,15,16 * * *',
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

-- Weekly plan: Thursday 08:20 UTC = 12:20 Tbilisi, for the following Monday–Sunday.
select cron.unschedule(jobid) from cron.job where jobname = 'samosell-social-weekly-plan';
select cron.schedule(
  'samosell-social-weekly-plan',
  '20 8 * * 4',
  $job$
    select net.http_get(
      url := 'https://samosell.ge/api/internal/social/plan',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'samosell_social_cron_secret')
      ),
      timeout_milliseconds := 60000
    );
  $job$
);
