create table if not exists public.tbc_live_test_attempts (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete restrict,
  amount numeric(10,2) not null default 1.00,
  currency text not null default 'GEL',
  status text not null default 'created',
  provider_payment_id text null,
  provider_checkout_url text null,
  provider_status text null,
  provider_result_code text null,
  failure_reason text null,
  callback_received_at timestamptz null,
  paid_at timestamptz null,
  refund_requested_at timestamptz null,
  refunded_at timestamptz null,
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tbc_live_test_amount_guard check (amount = 1.00),
  constraint tbc_live_test_currency_guard check (currency = 'GEL'),
  constraint tbc_live_test_status_guard check (
    status = any (
      array[
        'created'::text,
        'checkout_ready'::text,
        'succeeded'::text,
        'failed'::text,
        'expired'::text,
        'verification_failed'::text,
        'create_failed'::text,
        'refund_processing'::text,
        'returned'::text,
        'partial_returned'::text
      ]
    )
  ),
  constraint tbc_live_test_failure_reason_guard
    check (failure_reason is null or char_length(failure_reason) <= 1000)
);

create unique index if not exists tbc_live_test_provider_payment_id_uidx
  on public.tbc_live_test_attempts (provider_payment_id)
  where provider_payment_id is not null;

create index if not exists tbc_live_test_created_at_idx
  on public.tbc_live_test_attempts (created_at desc);

create index if not exists tbc_live_test_admin_created_at_idx
  on public.tbc_live_test_attempts (admin_id, created_at desc);

alter table public.tbc_live_test_attempts enable row level security;

revoke all on table public.tbc_live_test_attempts from public, anon, authenticated;
grant select, insert, update, delete on table public.tbc_live_test_attempts to service_role;
