-- Social Media Agent OS: daily Meta results sync.
-- social_metrics_daily keeps ONE row per post/platform (metric_date = the post's Tbilisi date) with the
-- latest lifetime totals, so sums never double count. impressions stores Meta's `views`.
-- social_account_stats: follower counts per platform, Instagram's online_followers (only returned by
-- Meta from 100 followers) and the last sync error, so the admin page can say what is missing.

create table if not exists public.social_account_stats (
  platform text primary key check (platform in ('instagram', 'facebook')),
  followers integer check (followers is null or followers >= 0),
  active_hours jsonb check (active_hours is null or jsonb_typeof(active_hours) = 'object'),
  error_code text check (error_code is null or error_code ~ '^[a-z0-9_]{1,64}$'),
  synced_at timestamptz not null default now()
);

alter table public.social_account_stats enable row level security;
drop policy if exists social_account_stats_admin_read on public.social_account_stats;
create policy social_account_stats_admin_read on public.social_account_stats for select to authenticated
  using (exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true));
revoke all on public.social_account_stats from anon, authenticated;
grant select on public.social_account_stats to authenticated;
grant select, insert, update on public.social_account_stats to service_role;
revoke delete, truncate, references, trigger on public.social_account_stats from service_role;

-- Daily at 07:40 UTC = 11:40 Tbilisi (Meta data can lag up to 48 h; once a day is enough).
select cron.unschedule(jobid) from cron.job where jobname = 'samosell-social-insights';
select cron.schedule(
  'samosell-social-insights',
  '40 7 * * *',
  $job$
    select net.http_get(
      url := 'https://samosell.ge/api/internal/social/insights',
      headers := jsonb_build_object(
        'Authorization',
        'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'samosell_social_cron_secret')
      ),
      timeout_milliseconds := 60000
    );
  $job$
);
