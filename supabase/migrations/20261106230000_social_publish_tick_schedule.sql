-- Social Media Agent OS: call the publishing worker at each daily posting slot.
-- Same pattern as samosell-tbc-recovery: pg_cron + pg_net, bearer read from Vault at run time
-- (the secret value is never stored in this file). Times are UTC; Tbilisi = UTC+4:
-- 08:05 / 14:05 / 15:05 / 16:05 UTC = 12:05 / 18:05 / 19:05 / 20:05 Tbilisi.
-- Prerequisite (once, outside version control):
--   select vault.create_secret('<same value as Vercel CRON_SECRET>', 'samosell_social_cron_secret');
-- The route only publishes approved, due posts and enforces kill switch / dry-run server-side.
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
      timeout_milliseconds := 30000
    );
  $job$
);
