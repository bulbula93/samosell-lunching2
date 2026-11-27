-- cron.job_run_details grew to ~65k rows / 20 MB (a third of the database)
-- because several jobs run every 5-15 minutes and history is never pruned.
-- Keep 7 days of run history; prune daily in bounded batches.
select cron.unschedule(jobid) from cron.job where jobname = 'samosell-cron-history-retention';

select cron.schedule(
  'samosell-cron-history-retention',
  '23 2 * * *',
  $$delete from cron.job_run_details
    where runid in (
      select runid from cron.job_run_details
      where end_time < now() - interval '7 days'
      limit 50000
    )$$
);
