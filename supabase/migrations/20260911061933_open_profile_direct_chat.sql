create function public.open_profile_direct_chat(p_recipient_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_user uuid:=auth.uid(); v_low uuid; v_high uuid; v_chat uuid; v_allowed boolean;
begin
  if v_user is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,false) then raise exception 'not_authenticated'; end if;
  if p_recipient_id is null or p_recipient_id=v_user then raise exception 'invalid_recipient'; end if;
  if not exists(select 1 from public.profiles where id=v_user and not is_suspended)
    or not exists(select 1 from public.profiles where id=p_recipient_id and not is_suspended) then raise exception 'conversation_not_found'; end if;
  if exists(select 1 from public.user_blocks where
    (blocker_id=v_user and blocked_id=p_recipient_id) or (blocker_id=p_recipient_id and blocked_id=v_user)) then raise exception 'conversation_blocked'; end if;
  v_low:=least(v_user::text,p_recipient_id::text)::uuid;
  v_high:=greatest(v_user::text,p_recipient_id::text)::uuid;
  select id into v_chat from public.chats where chat_type='direct'
    and least(buyer_id::text,seller_id::text)=v_low::text and greatest(buyer_id::text,seller_id::text)=v_high::text;
  if v_chat is null then
    select allowed into v_allowed from public.consume_action_rate_limit('chat_start',600,20);
    if not coalesce(v_allowed,false) then raise exception 'chat_rate_limited'; end if;
    insert into public.chats(listing_id,buyer_id,seller_id,chat_type)
    values(null,v_low,v_high,'direct') on conflict do nothing returning id into v_chat;
    if v_chat is null then
      select id into v_chat from public.chats where chat_type='direct'
        and least(buyer_id::text,seller_id::text)=v_low::text and greatest(buyer_id::text,seller_id::text)=v_high::text;
    end if;
  end if;
  if v_chat is null then raise exception 'conversation_not_found'; end if;
  update public.chats set
    buyer_archived_at=case when buyer_id=v_user then null else buyer_archived_at end,
    seller_archived_at=case when seller_id=v_user then null else seller_archived_at end
  where id=v_chat;
  return v_chat;
end; $$;
revoke all on function public.open_profile_direct_chat(uuid) from public,anon;
grant execute on function public.open_profile_direct_chat(uuid) to authenticated;
notify pgrst, 'reload schema';
