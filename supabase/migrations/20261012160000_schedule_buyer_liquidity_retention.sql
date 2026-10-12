-- Keep pseudonymous analytics detail only for the agreed retention window.
-- pg_cron runs in UTC; 03:17 UTC = 07:17 Asia/Tbilisi.
-- A stable job name makes repeated deployments idempotent.
select cron.schedule(
  'samosell-buyer-liquidity-retention',
  '17 3 * * *',
  $$select public.prune_catalog_engagement();$$
);
