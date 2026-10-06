-- DRAFT / NOT APPLIED. Retain succeeded runs 30 days; failed runs 90 days.
-- Keep running/starting/unknown/incomplete records. Business payment/ad/audit tables
-- are never touched. Export older failures before approval if still under investigation.
-- Each daily purge is bounded to 1000 terminal rows; initial backlog drains gradually.
-- DELETE creates WAL/dead tuples, so do not run an unbounded initial cleanup or VACUUM FULL.
select cron.schedule(
  'samosell-cron-history-retention', '23 3 * * *',
  $job$
  delete from cron.job_run_details
  where runid in (
    select runid from cron.job_run_details
    where end_time is not null and (
      (status = 'succeeded' and end_time < now() - interval '30 days') or
      (status = 'failed' and end_time < now() - interval '90 days')
    )
    order by end_time, runid
    limit 1000
  );
  $job$
);
-- Rollback schedule only: select cron.unschedule('samosell-cron-history-retention');
-- Deleted history is recoverable only from a prior export/backup.
