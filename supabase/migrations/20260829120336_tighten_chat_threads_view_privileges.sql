-- Keep the participant-filtered inbox view read-only at the Data API boundary.
revoke all on table public.chat_threads from anon, authenticated;
grant select on table public.chat_threads to authenticated;
