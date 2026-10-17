-- QA ONLY. Install disabled in the same transaction: there is no activation window.
select cron.schedule('samosell-ai-shadow-qa-v06','*/5 * * * *',
 $$set local statement_timeout='5s'; set local lock_timeout='2s'; set local role ai_ops_shadow_caller; select ai_ops_private.run_shadow_tick();$$);
select cron.alter_job(job_id:=(select jobid from cron.job where jobname='samosell-ai-shadow-qa-v06'),active:=false);
