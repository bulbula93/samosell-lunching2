-- Free-tier (Nano) compute ran out of Disk IO budget on 2026-11-28.
-- Lower the cadence of background jobs whose latency users don't feel.
-- Push dispatch stays at 5 minutes (chat notifications).
select cron.alter_job(j.jobid, schedule := s.schedule)
from cron.job j
join (values
  ('samosell-tbc-recovery', '*/15 * * * *'),          -- safety net for missed TBC callbacks (was */5)
  ('reconcile-listing-boosts', '*/30 * * * *'),       -- expire boosts (was */15)
  ('reconcile-self-service-brand-ads', '*/30 * * * *'), -- expire brand ads (was */15)
  ('samosell-indexnow-ping', '7 * * * *')             -- hourly (was */30)
) as s(jobname, schedule) on s.jobname = j.jobname;
