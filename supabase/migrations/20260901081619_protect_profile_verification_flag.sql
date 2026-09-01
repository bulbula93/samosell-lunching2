-- Seller verification is privileged trust metadata. Profile owners may edit
-- their public profile fields, but verification must only change through a
-- trusted admin/service path.
create or replace function public.protect_profile_privileged_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null and auth.uid() = new.id then
    if tg_op = 'INSERT' then
      new.is_admin := false;
      new.is_suspended := false;
      new.is_seller_verified := false;
    else
      new.is_admin := old.is_admin;
      new.is_suspended := old.is_suspended;
      new.is_seller_verified := old.is_seller_verified;
    end if;
  end if;

  return new;
end;
$$;

revoke execute on function public.protect_profile_privileged_fields()
  from public, anon, authenticated;
