-- Carousel inventory: up to 10 concurrent paid campaigns, then queue FIFO.
create or replace function public.approve_self_service_ad(p_ad_id uuid,p_reviewed_by uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_ad public.ads%rowtype; v_order public.ad_orders%rowtype; v_start timestamptz; v_end timestamptz; v_now timestamptz:=now(); v_duration interval; v_active integer;
begin
 if not exists(select 1 from public.profiles p where p.id=p_reviewed_by and p.is_admin=true) then raise exception 'A valid admin reviewer is required.' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtext('samosell_self_service_brand_ad_rotation'));
 select * into v_ad from public.ads where id=p_ad_id for update;
 if not found or v_ad.submitted_by is null then raise exception 'Self-service ad not found.' using errcode='P0002'; end if;
 select * into v_order from public.ad_orders where ad_id=p_ad_id for update;
 if not found or v_order.status<>'paid_pending_review' or v_order.paid_at is null then raise exception 'Self-service ad has not been paid and verified.' using errcode='42501'; end if;
 v_duration:=make_interval(days=>v_order.duration_days_snapshot);
 select count(*) into v_active from public.ad_orders where status='active' and ends_at>v_now;
 if v_active < 10 then v_start:=v_now;
 else
   select min(t.ends_at) into v_start from (
     select ends_at from public.ad_orders where status in ('active','scheduled') and ends_at>v_now order by ends_at asc limit 10
   ) t;
   if v_start is null then v_start:=v_now; end if;
 end if;
 v_end:=v_start+v_duration;
 update public.ads set placement_key='home_hero_left',review_status='approved',is_active=true,starts_at=v_start,ends_at=v_end,updated_at=now() where id=p_ad_id;
 update public.ad_orders set status=case when v_start<=v_now then 'active' else 'scheduled' end,selected_placement='home_hero_left',starts_at=v_start,ends_at=v_end,approved_at=coalesce(approved_at,v_now),reviewed_by=p_reviewed_by,updated_at=now() where id=v_order.id returning * into v_order;
 return jsonb_build_object('order_id',v_order.id,'ad_id',v_order.ad_id,'status',v_order.status,'placement','home_rotation','starts_at',v_order.starts_at,'ends_at',v_order.ends_at,'active_limit',10);
end; $$;
revoke all on function public.approve_self_service_ad(uuid,uuid) from public,anon,authenticated;
grant execute on function public.approve_self_service_ad(uuid,uuid) to service_role;
