-- Reading the general notification center must not mark chat replies as read.
create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security definer set search_path='' as $$
declare v_updated integer;
begin
  if auth.uid() is null then return 0; end if;
  update public.notifications set read_at=now()
  where user_id=auth.uid() and read_at is null
    and type not in ('chat_started','chat_message');
  get diagnostics v_updated=row_count;
  return v_updated;
end; $$;
revoke all on function public.mark_all_notifications_read() from public,anon,authenticated;
grant execute on function public.mark_all_notifications_read() to authenticated;
