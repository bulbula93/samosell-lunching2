-- Align official support replies with the authenticated chat_message rate-limit contract (20/min).
-- Preserve the existing function's authorization, idempotency and notification behavior.
do $fix$
declare v_definition text;
begin
  select pg_get_functiondef('public.admin_send_support_message(uuid,text,uuid)'::regprocedure)
    into v_definition;
  if v_definition is null
     or strpos(v_definition, 'consume_action_rate_limit(''chat_message'', 60, 30)') = 0 then
    raise exception 'Unexpected admin support RPC definition; refusing migration';
  end if;
  execute replace(
    v_definition,
    'consume_action_rate_limit(''chat_message'', 60, 30)',
    'consume_action_rate_limit(''chat_message'', 60, 20)'
  );
end
$fix$;
