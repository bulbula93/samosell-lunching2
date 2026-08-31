-- Internal search telemetry/config history is written and read only through
-- narrowly-scoped SECURITY DEFINER RPCs. Direct client table privileges are unnecessary.

revoke all on table public.search_impressions from anon, authenticated;
revoke all on table public.search_interactions from anon, authenticated;
revoke all on table public.search_ranking_config_history from anon, authenticated;
