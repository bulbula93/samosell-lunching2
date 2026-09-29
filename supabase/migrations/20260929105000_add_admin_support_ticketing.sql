create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users(id) on delete set null,
  account_email text not null,
  category text not null,
  subject text not null,
  message text not null,
  status text not null default 'open',
  priority text not null default 'normal',
  assigned_to uuid null references public.profiles(id) on delete set null,
  admin_note text null,
  reviewed_at timestamptz null,
  closed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint support_tickets_category_check
    check (category = any (array['account'::text, 'listing'::text, 'chat'::text, 'technical'::text, 'safety'::text, 'other'::text])),
  constraint support_tickets_status_check
    check (status = any (array['open'::text, 'reviewing'::text, 'resolved'::text, 'closed'::text])),
  constraint support_tickets_priority_check
    check (priority = any (array['normal'::text, 'high'::text])),
  constraint support_tickets_subject_length_guard
    check (char_length(subject) between 3 and 120),
  constraint support_tickets_message_length_guard
    check (char_length(message) between 10 and 4000),
  constraint support_tickets_email_length_guard
    check (char_length(account_email) between 3 and 320),
  constraint support_tickets_admin_note_length_guard
    check (admin_note is null or char_length(admin_note) <= 2000)
);

create index if not exists support_tickets_status_created_at_idx
  on public.support_tickets (status, created_at desc);
create index if not exists support_tickets_priority_created_at_idx
  on public.support_tickets (priority, created_at desc);
create index if not exists support_tickets_user_id_created_at_idx
  on public.support_tickets (user_id, created_at desc)
  where user_id is not null;
create index if not exists support_tickets_assigned_to_idx
  on public.support_tickets (assigned_to)
  where assigned_to is not null;

alter table public.support_tickets enable row level security;

revoke all on table public.support_tickets from public, anon, authenticated;
grant select on table public.support_tickets to authenticated;

drop policy if exists "support tickets owner or admin select" on public.support_tickets;
create policy "support tickets owner or admin select"
on public.support_tickets
for select
to authenticated
using (
  (select auth.uid()) = user_id
  or (select public.is_current_user_admin())
);

create or replace function public.submit_support_ticket(
  p_category text,
  p_subject text,
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_email text;
  v_category text := lower(btrim(coalesce(p_category, '')));
  v_subject text := btrim(regexp_replace(coalesce(p_subject, ''), E'[\\r\\n]+', ' ', 'g'));
  v_message text := btrim(coalesce(p_message, ''));
  v_ticket_id uuid;
begin
  if v_actor is null then
    raise exception 'not_authenticated';
  end if;

  select lower(btrim(email))
    into v_email
  from auth.users
  where id = v_actor;

  if v_email is null or v_email = '' then
    raise exception 'support_email_missing';
  end if;

  if v_category <> all (array['account', 'listing', 'chat', 'technical', 'safety', 'other']) then
    raise exception 'invalid_support_category';
  end if;

  if char_length(v_subject) < 3 or char_length(v_subject) > 120 then
    raise exception 'invalid_support_subject';
  end if;

  if char_length(v_message) < 10 or char_length(v_message) > 4000 then
    raise exception 'invalid_support_message';
  end if;

  insert into public.support_tickets (
    user_id,
    account_email,
    category,
    subject,
    message,
    priority
  )
  values (
    v_actor,
    v_email,
    v_category,
    v_subject,
    v_message,
    case when v_category = 'safety' then 'high' else 'normal' end
  )
  returning id into v_ticket_id;

  return v_ticket_id;
end;
$$;

revoke all on function public.submit_support_ticket(text, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_support_ticket(text, text, text)
  to authenticated;

alter table public.admin_audit_log
  add column if not exists target_support_ticket_id uuid null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_audit_log_target_support_ticket_id_fkey'
      and conrelid = 'public.admin_audit_log'::regclass
  ) then
    alter table public.admin_audit_log
      add constraint admin_audit_log_target_support_ticket_id_fkey
      foreign key (target_support_ticket_id)
      references public.support_tickets(id)
      on delete set null;
  end if;
end
$$;

create index if not exists admin_audit_log_support_ticket_idx
  on public.admin_audit_log (target_support_ticket_id, created_at desc)
  where target_support_ticket_id is not null;

alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_action_check;

alter table public.admin_audit_log
  add constraint admin_audit_log_action_check
  check (
    action = any (
      array[
        'listing.hide'::text,
        'listing.restore'::text,
        'user.suspend'::text,
        'user.restore'::text,
        'seller.verify'::text,
        'seller.unverify'::text,
        'category.update'::text,
        'support.review'::text,
        'support.resolve'::text,
        'support.close'::text,
        'support.reopen'::text
      ]
    )
  );

alter table public.admin_audit_log
  drop constraint if exists admin_audit_log_target_guard;

alter table public.admin_audit_log
  add constraint admin_audit_log_target_guard
  check (
    target_listing_id is not null
    or target_user_id is not null
    or target_category_id is not null
    or target_support_ticket_id is not null
  );

create or replace function public.admin_manage_support_ticket(
  p_ticket_id uuid,
  p_action text,
  p_note text default ''
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_ticket public.support_tickets%rowtype;
  v_note text := btrim(coalesce(p_note, ''));
  v_next_status text;
  v_audit_action text;
begin
  if v_actor is null then
    raise exception 'not_authenticated';
  end if;

  if not public.is_current_user_admin() then
    raise exception 'not_authorized';
  end if;

  if char_length(v_note) > 2000 then
    raise exception 'admin_note_too_long';
  end if;

  select *
    into v_ticket
  from public.support_tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'support_ticket_not_found';
  end if;

  case p_action
    when 'reviewing' then
      if v_ticket.status <> 'open' then
        raise exception 'invalid_support_transition';
      end if;
      v_next_status := 'reviewing';
      v_audit_action := 'support.review';

    when 'resolved' then
      if v_ticket.status not in ('open', 'reviewing') then
        raise exception 'invalid_support_transition';
      end if;
      v_next_status := 'resolved';
      v_audit_action := 'support.resolve';

    when 'closed' then
      if v_ticket.status not in ('open', 'reviewing', 'resolved') then
        raise exception 'invalid_support_transition';
      end if;
      v_next_status := 'closed';
      v_audit_action := 'support.close';

    when 'reopen' then
      if v_ticket.status not in ('resolved', 'closed') then
        raise exception 'invalid_support_transition';
      end if;
      v_next_status := 'reviewing';
      v_audit_action := 'support.reopen';

    else
      raise exception 'invalid_support_action';
  end case;

  update public.support_tickets
  set
    status = v_next_status,
    assigned_to = v_actor,
    admin_note = case
      when v_note = '' then admin_note
      else v_note
    end,
    reviewed_at = case
      when v_next_status in ('reviewing', 'resolved', 'closed') then now()
      else reviewed_at
    end,
    closed_at = case
      when v_next_status = 'closed' then now()
      else null
    end,
    updated_at = now()
  where id = p_ticket_id;

  insert into public.admin_audit_log (
    actor_id,
    action,
    target_user_id,
    target_support_ticket_id,
    note,
    metadata
  )
  values (
    v_actor,
    v_audit_action,
    v_ticket.user_id,
    p_ticket_id,
    nullif(v_note, ''),
    jsonb_build_object(
      'previous_status', v_ticket.status,
      'next_status', v_next_status,
      'category', v_ticket.category,
      'priority', v_ticket.priority
    )
  );

  return v_next_status;
end;
$$;

revoke all on function public.admin_manage_support_ticket(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.admin_manage_support_ticket(uuid, text, text)
  to authenticated;
