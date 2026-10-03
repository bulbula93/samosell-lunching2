do $$
begin
  if exists (select 1 from cron.job where jobname = 'samosell-useful-notifications') then
    perform cron.unschedule('samosell-useful-notifications');
  end if;
end $$;

select cron.schedule(
  'samosell-useful-notifications',
  '15 8 * * *',
  $job$
    select net.http_get(
      url := 'https://samosell.ge/api/internal/notifications/reconcile',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'samosell_tbc_recovery_token'
          limit 1
        )
      ),
      timeout_milliseconds := 30000
    ) as request_id;
  $job$
);
