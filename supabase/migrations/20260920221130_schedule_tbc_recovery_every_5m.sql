select cron.schedule(
  'samosell-tbc-recovery',
  '*/5 * * * *',
  $job$
    select net.http_get(
      url := 'https://samosell.ge/api/internal/tbc/reconcile',
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
