-- Fix anonymous Story rail reads without granting anonymous access to private
-- mute/block relationship tables. Keep anonymous and authenticated visibility
-- rules separate so the anonymous policy never references story_mutes/user_blocks.

drop policy if exists "public can read active stories" on public.stories;
drop policy if exists "anonymous can read active stories" on public.stories;
drop policy if exists "authenticated can read active stories" on public.stories;

create policy "anonymous can read active stories"
on public.stories
for select
to anon
using (
  deleted_at is null
  and expires_at > now()
  and exists (
    select 1
    from public.profiles p
    where p.id = stories.user_id
      and not p.is_suspended
  )
);

create policy "authenticated can read active stories"
on public.stories
for select
to authenticated
using (
  deleted_at is null
  and expires_at > now()
  and exists (
    select 1
    from public.profiles p
    where p.id = stories.user_id
      and not p.is_suspended
  )
  and not exists (
    select 1
    from public.user_blocks b
    where (b.blocker_id = (select auth.uid()) and b.blocked_id = stories.user_id)
       or (b.blocker_id = stories.user_id and b.blocked_id = (select auth.uid()))
  )
  and not exists (
    select 1
    from public.story_mutes sm
    where sm.user_id = (select auth.uid())
      and sm.muted_user_id = stories.user_id
  )
);
