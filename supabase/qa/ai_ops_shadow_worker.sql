-- QA ONLY: reviewed/provisioned only on ydocqjdjmffysexkzxyc. Never auto-migrate Production.
-- First worker is deterministic QA queue-health observation, not an LLM/customer agent.
create role ai_ops_shadow_engine nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
create role ai_ops_shadow_caller nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;
grant ai_ops_shadow_engine, ai_ops_shadow_caller to postgres;
create schema ai_ops_private authorization ai_ops_shadow_engine;
revoke all on schema ai_ops_private from public, anon, authenticated, service_role;
grant usage on schema public to ai_ops_shadow_engine;
grant usage on schema ai_ops_private to ai_ops_shadow_caller;
alter role ai_ops_shadow_engine set statement_timeout='5s';

alter table public.ai_ops_control
 add column worker_enabled boolean not null default false,
 add column scheduler_enabled boolean not null default false,
 add column last_tick_at timestamptz,
 add column last_tick_status text;
alter table public.ai_ops_jobs add column lease_token uuid;
alter table public.ai_ops_activity add column sequence bigint generated always as identity;
alter table public.ai_ops_activity alter column created_at set default clock_timestamp();
create unique index ai_ops_activity_sequence_idx on public.ai_ops_activity(sequence);
grant usage on sequence public.ai_ops_activity_sequence_seq to ai_ops_shadow_engine;
grant select(sequence) on public.ai_ops_activity to ai_ops_qa_reader;
create index ai_ops_jobs_expired_lease_idx on public.ai_ops_jobs(leased_until) where status='leased';

grant select on public.ai_ops_jobs to ai_ops_shadow_engine;
grant insert(idempotency_key,role,kind,status,priority,max_attempts) on public.ai_ops_jobs to ai_ops_shadow_engine;
grant update(status,attempt,leased_until,lease_token,scheduled_at,updated_at) on public.ai_ops_jobs to ai_ops_shadow_engine;
grant insert(job_id,role,event_type,details) on public.ai_ops_activity to ai_ops_shadow_engine;
grant select on public.ai_ops_control to ai_ops_shadow_engine;
grant update(last_tick_at,last_tick_status) on public.ai_ops_control to ai_ops_shadow_engine;
create policy ai_ops_jobs_engine_read on public.ai_ops_jobs for select to ai_ops_shadow_engine using (true);
create policy ai_ops_jobs_engine_insert on public.ai_ops_jobs for insert to ai_ops_shadow_engine with check(role='technical' and kind='shadow_technical');
create policy ai_ops_jobs_engine_update on public.ai_ops_jobs for update to ai_ops_shadow_engine using(role='technical' and kind='shadow_technical') with check(role='technical' and kind='shadow_technical');
create policy ai_ops_activity_engine_insert on public.ai_ops_activity for insert to ai_ops_shadow_engine with check(role='technical');
create policy ai_ops_control_engine_read on public.ai_ops_control for select to ai_ops_shadow_engine using(true);
create policy ai_ops_control_engine_status on public.ai_ops_control for update to ai_ops_shadow_engine using(singleton) with check(singleton);
grant select(worker_enabled,scheduler_enabled,last_tick_at,last_tick_status) on public.ai_ops_control to ai_ops_qa_reader;

set local role ai_ops_shadow_engine;
create table ai_ops_private.scope(project_ref text primary key check(project_ref='ydocqjdjmffysexkzxyc'));
insert into ai_ops_private.scope values('ydocqjdjmffysexkzxyc');
alter table ai_ops_private.scope enable row level security;
alter table ai_ops_private.scope force row level security;
create policy scope_engine_read on ai_ops_private.scope for select to ai_ops_shadow_engine using(project_ref='ydocqjdjmffysexkzxyc');
revoke all on ai_ops_private.scope from public,anon,authenticated,service_role;

-- A shared control-row lock linearizes stop with each short transaction; missing control denies work.
create function ai_ops_private.can_work() returns boolean language plpgsql security invoker set search_path=pg_catalog as $$
declare c record;
begin
 if not exists(select 1 from ai_ops_private.scope where project_ref='ydocqjdjmffysexkzxyc') then return false; end if;
 select stopped,worker_enabled into c from public.ai_ops_control where singleton for share;
 return found and not c.stopped and c.worker_enabled;
end $$;

create function ai_ops_private.enqueue_observation() returns integer language plpgsql security invoker set search_path=pg_catalog as $$
declare j uuid;
begin
 if not ai_ops_private.can_work() then return 0; end if;
 insert into public.ai_ops_jobs(idempotency_key,role,kind,status,priority,max_attempts)
 values('shadow:technical:' || floor(extract(epoch from statement_timestamp())/300)::bigint,'technical','shadow_technical','queued','normal',3)
 on conflict(idempotency_key) do nothing returning id into j;
 if j is null then return 0; end if;
 insert into public.ai_ops_activity(job_id,role,event_type,details) values(j,'technical','queued','{"scope":"qa_queue_metadata","mode":"shadow"}');
 return 1;
end $$;

create function ai_ops_private.claim_observation() returns table(job_id uuid,token uuid) language plpgsql security invoker set search_path=pg_catalog as $$
declare j uuid; t uuid;
begin
 if not ai_ops_private.can_work() then return; end if;
 select id into j from public.ai_ops_jobs where role='technical' and kind='shadow_technical' and status='queued'
 and scheduled_at <= clock_timestamp() and attempt < max_attempts
 order by case priority when 'critical' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,scheduled_at,id
 for update skip locked limit 1;
 if j is null then return; end if;
 t := gen_random_uuid();
 update public.ai_ops_jobs set status='leased',attempt=attempt+1,lease_token=t,leased_until=clock_timestamp()+interval '60 seconds',updated_at=clock_timestamp() where id=j;
 insert into public.ai_ops_activity(job_id,role,event_type,details) values(j,'technical','claimed','{"scope":"qa_queue_metadata","mode":"shadow"}');
 return query select j,t;
end $$;

create function ai_ops_private.finish_observation(p_id uuid,p_token uuid) returns boolean language plpgsql security invoker set search_path=pg_catalog as $$
declare j record; counts jsonb;
begin
 if not ai_ops_private.can_work() then return false; end if;
 select id into j from public.ai_ops_jobs where id=p_id and role='technical' and kind='shadow_technical' and status='leased'
 and lease_token=p_token and leased_until>clock_timestamp() for update;
 if not found then return false; end if;
 select jsonb_build_object('scope','qa_queue_metadata','mode','shadow','outcome','queue_health_observed',
 'queued',(count(*) filter(where status='queued'))::integer,
 'dead_letter',(count(*) filter(where status='dead_letter'))::integer,
 'expired_leases',(count(*) filter(where status='leased' and leased_until <= clock_timestamp()))::integer) into counts from public.ai_ops_jobs;
 update public.ai_ops_jobs set status='completed',lease_token=null,leased_until=null,updated_at=clock_timestamp() where id=p_id;
 insert into public.ai_ops_activity(job_id,role,event_type,details) values(p_id,'technical','completed',counts);
 return true;
end $$;

create function ai_ops_private.fail_observation(p_id uuid,p_token uuid,p_code text) returns boolean language plpgsql security invoker set search_path=pg_catalog as $$
declare j record; next_status text;
begin
 if p_code not in ('execution_failed','query_timeout','lease_expired') or p_code is null then raise exception 'invalid_failure_code'; end if;
 if not ai_ops_private.can_work() then return false; end if;
 select attempt,max_attempts into j from public.ai_ops_jobs where id=p_id and role='technical' and kind='shadow_technical' and status='leased'
 and lease_token=p_token and leased_until>clock_timestamp() for update;
 if not found then return false; end if;
 next_status := case when j.attempt>=j.max_attempts then 'dead_letter' else 'queued' end;
 update public.ai_ops_jobs set status=next_status,lease_token=null,leased_until=null,
 scheduled_at=clock_timestamp()+make_interval(secs=>least(300,power(2,j.attempt)::integer*5)),updated_at=clock_timestamp() where id=p_id;
 insert into public.ai_ops_activity(job_id,role,event_type,details) values(p_id,'technical','failed',jsonb_build_object('scope','qa_queue_metadata','code',p_code,'next_status',next_status));
 return true;
end $$;

create function ai_ops_private.recover_observations() returns integer language plpgsql security invoker set search_path=pg_catalog as $$
declare j record; recovered integer:=0; next_status text;
begin
 if not ai_ops_private.can_work() then return 0; end if;
 for j in select id,attempt,max_attempts from public.ai_ops_jobs where role='technical' and kind='shadow_technical' and status='leased'
 and leased_until <= clock_timestamp() order by leased_until,id for update skip locked limit 20 loop
 next_status:=case when j.attempt>=j.max_attempts then 'dead_letter' else 'queued' end;
 update public.ai_ops_jobs set status=next_status,lease_token=null,leased_until=null,
 scheduled_at=clock_timestamp()+make_interval(secs=>least(300,power(2,j.attempt)::integer*5)),updated_at=clock_timestamp() where id=j.id;
 insert into public.ai_ops_activity(job_id,role,event_type,details) values(j.id,'technical','failed',jsonb_build_object('scope','qa_queue_metadata','code','lease_expired','next_status',next_status));
 recovered:=recovered+1;
 end loop;
 return recovered;
end $$;

-- Only public entry point is in a non-exposed schema, owned by a constrained NOLOGIN role.
-- It accepts no SQL, action parameters, model output, URLs, or customer input.
create function ai_ops_private.run_shadow_tick() returns jsonb language plpgsql security definer set search_path=pg_catalog set statement_timeout='5s' as $$
declare c record; j record; queued integer:=0; recovered integer:=0; completed integer:=0; failed integer:=0; i integer;
begin
 if not ai_ops_private.can_work() then return jsonb_build_object('state','stopped'); end if;
 select scheduler_enabled into c from public.ai_ops_control where singleton;
 if not c.scheduler_enabled then return jsonb_build_object('state','scheduler_disabled'); end if;
 if not pg_try_advisory_xact_lock(762018,6) then return jsonb_build_object('state','busy'); end if;
 recovered:=ai_ops_private.recover_observations();
 queued:=ai_ops_private.enqueue_observation();
 for i in 1..5 loop
 select * into j from ai_ops_private.claim_observation();
 exit when not found;
 begin
 if ai_ops_private.finish_observation(j.job_id,j.token) then completed:=completed+1; end if;
 exception when others then
 if ai_ops_private.fail_observation(j.job_id,j.token,'execution_failed') then failed:=failed+1; end if;
 end;
 end loop;
 update public.ai_ops_control set last_tick_at=clock_timestamp(),last_tick_status=case when failed>0 then 'failed' else 'completed' end where singleton;
 return jsonb_build_object('state','completed','enqueued',queued,'recovered',recovered,'completed',completed,'failed',failed);
end $$;
revoke all on all functions in schema ai_ops_private from public,anon,authenticated,service_role;
grant execute on function ai_ops_private.run_shadow_tick() to ai_ops_shadow_caller;
reset role;
