create table if not exists public.flitt_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  order_id text not null unique,
  user_id uuid references auth.users(id) on delete set null,
  mode text not null default 'test' check (mode in ('test', 'live')),
  purpose text not null default 'sandbox_test',
  amount integer not null check (amount > 0),
  currency text not null default 'GEL' check (currency ~ '^[A-Z]{3}$'),
  merchant_id text not null,
  provider_payment_id text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'expired', 'reversed', 'failed')),
  provider_status text,
  response_status text,
  callback_count integer not null default 0 check (callback_count >= 0),
  last_callback_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_flitt_payment_attempts_user_created
  on public.flitt_payment_attempts (user_id, created_at desc);

create unique index if not exists idx_flitt_payment_attempts_provider_payment
  on public.flitt_payment_attempts (provider_payment_id)
  where provider_payment_id is not null;

alter table public.flitt_payment_attempts enable row level security;

revoke all on table public.flitt_payment_attempts from anon;
revoke insert, update, delete on table public.flitt_payment_attempts from authenticated;
grant select on table public.flitt_payment_attempts to authenticated;
grant all on table public.flitt_payment_attempts to service_role;

drop policy if exists "owners can read own flitt attempts" on public.flitt_payment_attempts;
create policy "owners can read own flitt attempts"
  on public.flitt_payment_attempts
  for select
  to authenticated
  using (user_id = (select auth.uid()));

comment on table public.flitt_payment_attempts is
  'Flitt payment attempts. Initial integration uses purpose=sandbox_test and must not activate paid services.';
