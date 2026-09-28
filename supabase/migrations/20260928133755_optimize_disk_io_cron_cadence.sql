-- Reduce pg_cron write amplification without changing payment recovery or push latency.
-- Listing/ad visibility is timestamp-gated in public read paths; these jobs mainly reconcile persisted status.

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'reconcile-listing-boosts'
  limit 1;

  if v_job_id is not null then
    perform cron.alter_job(v_job_id, schedule := '*/15 * * * *');
  end if;

  select jobid into v_job_id
  from cron.job
  where jobname = 'reconcile-self-service-brand-ads'
  limit 1;

  if v_job_id is not null then
    perform cron.alter_job(v_job_id, schedule := '*/15 * * * *');
  end if;
end
$$;
