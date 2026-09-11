-- Keep media seven days after expiry AND deletion (whichever is later).
-- Never prune validation evidence for a published Story.
create or replace function public.list_expired_story_media_for_cleanup(p_limit integer default 100)
returns table(story_id uuid,media_path text)
language sql stable security definer set search_path='' as $$
  select s.id,o.name from storage.objects o
  left join public.stories s on s.media_path=o.name
  where o.bucket_id='story-media'
    and o.name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp|mp4|webm)$'
    and not exists(select 1 from public.story_upload_plans p where p.media_path=o.name and p.expires_at>now() and p.revoked_at is null)
    and (
      (s.id is null and o.created_at<now()-interval '2 hours')
      or (s.expires_at<now()-interval '7 days' and (s.deleted_at is null or s.deleted_at<now()-interval '7 days'))
    )
  order by o.created_at,o.name limit least(greatest(coalesce(p_limit,100),1),500);
$$;
revoke all on function public.list_expired_story_media_for_cleanup(integer) from public,anon,authenticated;
grant execute on function public.list_expired_story_media_for_cleanup(integer) to service_role;

create function public.prune_unpublished_story_upload_plans(p_limit integer default 100)
returns integer language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  with candidates as (
    select p.story_id from public.story_upload_plans p
    where p.published_at is null and p.expires_at<now()-interval '24 hours'
      and not exists(select 1 from public.stories s where s.id=p.story_id or s.media_path=p.media_path)
      and not exists(select 1 from storage.objects o where o.bucket_id='story-media' and o.name=p.media_path)
    order by p.expires_at,p.story_id limit least(greatest(coalesce(p_limit,100),1),500)
    for update of p skip locked
  ) delete from public.story_upload_plans p using candidates c where p.story_id=c.story_id;
  get diagnostics v_count=row_count;
  return v_count;
end;
$$;
revoke all on function public.prune_unpublished_story_upload_plans(integer) from public,anon,authenticated;
grant execute on function public.prune_unpublished_story_upload_plans(integer) to service_role;
