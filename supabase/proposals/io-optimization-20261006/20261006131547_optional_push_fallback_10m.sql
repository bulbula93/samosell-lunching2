-- OPTIONAL DRAFT / NOT APPLIED. Not part of the recommended initial release.
-- Live enqueue_notification_push calls request_push_dispatch immediately; cron is
-- retry/recovery. A 10m cadence retains first delivery but adds up to 5m retry lag.
-- Approve only after accepting that fallback latency and verifying dispatcher backlog.
-- TBC recovery remains */5. Boosts/ads remain */15.
do $migration$
declare target_job bigint;
begin
  select jobid into strict target_job from cron.job
    where jobname = 'samosell-push-dispatch' and active and schedule = '*/5 * * * *';
  perform cron.alter_job(target_job, schedule := '*/10 * * * *');
end;
$migration$;
-- Rollback: cron.alter_job for this exact job back to */5 * * * *.
