alter table public.ads
  add column if not exists submitted_by uuid references auth.users(id) on delete set null,
  add column if not exists review_status text not null default 'approved';

alter table public.ads
  drop constraint if exists ads_review_status_check;

alter table public.ads
  add constraint ads_review_status_check
  check (review_status in ('pending', 'approved', 'rejected'));

create index if not exists ads_submitted_by_created_idx
  on public.ads (submitted_by, created_at desc)
  where submitted_by is not null;

comment on column public.ads.submitted_by is
  'Authenticated SamoSell user who created the advertisement through the self-service advertising flow.';

comment on column public.ads.review_status is
  'Moderation state for self-service ads. Public visibility still requires is_active=true and a valid schedule.';
