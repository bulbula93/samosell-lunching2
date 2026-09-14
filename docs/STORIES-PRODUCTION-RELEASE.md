# Stories + Following v1 controlled release

Status: code preparation only. No production write, backup, migration, merge,
deployment or cleanup activation was performed by this audit. Final two-user
Windows E2E and backup confirmation remain release gates.

## Read-only production snapshot — 2026-09-11

Project: `lxsvjzbiuewgwpajqrwr`. Production migration history contains none of
the seven migrations below. `public.stories` and `public.story_upload_plans`
are absent. Existing profiles, chats, messages and notifications columns match
the prerequisite names used by the Story migrations. This is metadata inspection,
not a claim that production migrations were executed successfully.
The `on_auth_user_created -> handle_new_user` trigger is present. Realtime
currently contains chats/messages but not notifications; the likes/reply
notification migration explicitly adds notifications. The Story bucket is absent.

The live PR initially pointed at `b629599e76224a82d2fdc071c31c48e865d77b24`.
The five initial review findings were resolved; three subsequent findings were
open: realtime reply hydration, stale owner media on fetch failure and priority
filtering after the report limit. The final patch addresses those too.

Production security advisors report existing INFO notices for ten deliberately
RLS-only tables, SECURITY DEFINER exposure warnings (6 anonymous, 29 signed-in)
and disabled leaked-password protection. These are baseline findings, not new
Story objects. Each exposed RPC needs its existing authorization guard retained;
do not blanket revoke public search or messaging APIs. No paid Auth option was
enabled. Remediation references:
[function exposure](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
Run both advisors again after the controlled apply; this baseline is not a
post-migration clearance.

## Final automated evidence

Node 22.23.2, pnpm 10.17.1, Next 16.2.3 Webpack:
frozen install, `tsc --noEmit`, full ESLint PASS. Full suite: **85 files / 446
tests PASS**. Targeted Story/chat/cleanup/PWA regression selection: **13 files /
79 tests PASS**; cleanup tests alone **13 PASS**, PWA action-cache regressions
**6 PASS**. No existing assertion was removed or weakened. Full-suite runs first
exposed loading/like UI timing bugs; both were fixed in code before the final pass.
Production build PASS using a LOCAL Supabase URL and a private fake credential
sentinel. The manifest verifier passed: each of prepareStoryUploadAction,
publishStoryAction and abortStoryUploadAction has exactly one homepage worker
identity matching client chunks. 108 client chunks checked; no sentinel or
privileged Story media/cleanup module leakage. Safe worker still caches icons
only; action POSTs, application chunks and private media bypass CacheStorage.
No authenticated browser E2E or production cleanup execution is claimed here.

Performance baseline: 14 unindexed foreign keys (INFO), 25 auth RLS initplan
warnings, 39 unused indexes (INFO), 10 multiple-permissive-policy warnings.
These predate Story installation; inspect new deltas after apply, without
changing unrelated payment tables in this task.

The seven-step generated bundle was actually applied to a separate local
PostgreSQL rehearsal database using the pre-Story application schema dump and
local Supabase infrastructure schemas. All seven per-step checks passed. This
is not a production backup restore or an authenticated browser/Storage E2E.
Reapplying that bundle was rejected by its migration-history guard. A rollback-only
test on the rehearsal PostgreSQL database also passed direct authenticated Storage
INSERT denial, the authorized upload metadata trigger, active media exclusion,
expired/recently deleted retention and published-plan preservation.

## Cleanup architecture and cost

`POST /api/internal/story-cleanup` is Node server-only. It accepts no paths,
limits, project IDs or credentials from the body/query. It requires a dedicated
32+ character bearer secret, explicit enable flag, `VERCEL_ENV=production`,
the exact expected project ref and exact HTTPS Supabase URL. GET is unsupported.
All responses are no-store; failures log a fixed operational code, never paths,
content, keys or raw Supabase errors. The service role stays on Vercel.

Only the service-role RPC selects objects in `story-media`. The worker validates
each exact UUID/UUID/UUID.extension path before calling Storage's remove API.
It never deletes Storage metadata using SQL. It processes at most 100 objects
and 100 plans per request; the database also hard-caps requests at 500.

- Orphans: actual Storage objects older than two hours with no Story and no
  live unrevoked upload plan. Publication requires the original ten-minute plan,
  so an old orphan cannot become publishable while deletion is in flight.
- Story media: expiry must be over seven days ago and, if deleted, deletion
  must also be over seven days ago. This conservative rule preserves moderation
  evidence seven days after the later event, including early-deleted Stories.
- Authenticated roles cannot extend expiry or reassign existing Story paths;
  normal moderation only hides Stories. Do not manually resurrect or rewrite
  media paths with privileged SQL while cleanup is running.
- Pruning: expired over 24 hours, unpublished, no Story reference and no Storage
  object. Published validation evidence is retained. Row locks with SKIP LOCKED
  and bounded deletes protect concurrent pruning.
- Storage failure stops pruning. Partial or timed-out removal retries safely:
  remaining Storage objects are selected again; removed ones disappear from the
  next scan. No deletion watermark is advanced on failure.
- Legacy malformed paths are skipped, never broadened into a wildcard. Review
  any such objects manually. A persistent `atCapacity=true` means backlog:
  inspect throughput rather than removing the batch cap.

The existing `scripts/cleanup-story-media.mjs` remains a non-production manual
tool and still refuses this production project. It now uses bounded plan pruning.

Scheduler choice: GitHub Actions, minute 37 each hour, standard `ubuntu-latest`,
no checkout, no dependency installation, no cache/artifact storage, no service
role in GitHub. This repository was verified PUBLIC. Standard hosted runners
for public repositories are free:
[GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions).
Vercel Hobby allows daily cron only (current docs: 100 jobs, once/day, imprecise
within the hour), so it cannot provide free hourly execution:
[Vercel limits](https://vercel.com/docs/cron-jobs/usage-and-pricing).
[Supabase Cron](https://supabase.com/docs/guides/cron) supports fine cadence but
would require production scheduler/HTTP-secret configuration inside the DB;
the existing public GitHub runner avoids that additional operational surface.

No new subscription or paid feature is required. Existing Vercel function and
Supabase resource quotas still apply; this does not promise unlimited free usage.
Re-evaluate billing before making the repository private. GitHub cron can be
delayed/dropped and public schedules disable after 60 days without repository
activity; it is not an exact-hour SLA:
[schedule behavior](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
Delayed cleanup only extends retention; it never makes private Stories visible.

### Activation is a later manual release step

Workflow has an explicit `vars.STORY_CLEANUP_ENABLED == 'true'` gate and only
runs in this repository on main. Until enabled the job does not run. Create
GitHub environment `story-production-cleanup`, restrict it to main, and keep
environment secrets away from PR workflows. Do not set any of these during this
readiness task:

| Location | Names (values must never be logged) |
| --- | --- |
| Vercel production only | `STORY_CLEANUP_SECRET`, `STORY_CLEANUP_PROJECT_REF`, `STORY_CLEANUP_ENABLED`, existing `SUPABASE_SERVICE_ROLE_KEY`, existing `NEXT_PUBLIC_SUPABASE_URL` |
| GitHub repository variable | `STORY_CLEANUP_ENABLED` (absent/false until smoke passes) |
| GitHub environment variable | `STORY_CLEANUP_URL` (canonical HTTPS production URL ending `/api/internal/story-cleanup`, no redirect) |
| GitHub environment secret | `STORY_CLEANUP_SECRET` (same dedicated bearer secret) |
| Optional Vercel incident control | `STORIES_UI_DISABLED` |

The job has one concurrency group, five-minute timeout and two retries on
eligible HTTP errors. Never follow redirects with the Authorization header.
Use a high-entropy dedicated secret generated in a password manager. To stop,
disable the GitHub workflow or unset its enable variable first, then disable the
Vercel flag/redeploy or rotate the secret. An already-running batch may finish.

## Database object/config audit

| Requirement | Source / invariant |
| --- | --- |
| Private bucket | Base creates `story-media`, hardening sets public=false; 25 MiB bucket max and explicit MIME list |
| Browser writes | Restrictive INSERT/UPDATE denials for Story bucket; signed upload is server-issued, exact-path; no broad direct uploads |
| Plan | Hardening creates `story_upload_plans`, prepare/abort RPCs, Storage insert trigger, ten-minute expiry, uploaded_at single use; no client plan table grants |
| Limits | 20 upload preparations/hour, 20 creations/hour, max 10 active; image 12 MiB/video 25 MiB; caption 280 |
| Media validation | Server downloads bytes, size/magic check and pinned mediabunny metadata validation; video <=15000ms; unknown duration fails closed; trusted validation stamp required by create_story |
| Expiry | DB check: expires_at=created_at+24 hours; active query/RLS checks time and deletion |
| Read policies | Separate anon/authenticated policies; authenticated both-direction blocks and mutes; suspended profiles hidden; admin path separate |
| Follows/mutes | Auth.uid-derived RPCs, no self, blocks respected; block removes follows in both directions |
| Views/clicks | Unique viewer/Story; anonymous listing clicks not persisted; authenticated dedupe and self-owner exclusion in seller analytics |
| Replies/chats | Atomic reply_to_story validates owner/listing, blocks and Story state; direct pairs canonical/unique; text insert policy cannot forge story_reply |
| Private delivery | `/api/stories/media/[storyId]` queries with caller RLS, no-store, signed URL <=60s and capped to remaining lifetime |
| Signed media caveat | Already-issued URLs can remain usable until TTL; permanent public URL denied; logout/expiry cannot revoke an already-issued URL instantly |
| Reports/admin | Unique report per viewer; derived owner; invoker admin view; admin-only moderation RPC; kind/status/high-reason filtering before Story row cap |
| Likes | One toggle per user/Story, count visible to owner; 60 changes/min; never creates chat messages |
| Notifications | Story reply trigger creates unread inbox event atomically; chat/general read states separated |
| Cleanup | Seventh migration replaces eligibility and adds service-role-only bounded plan pruning; no scheduler activated by SQL |

Prerequisites outside these migrations: existing marketplace baseline (profiles,
listings, listing_images, chats, messages, notifications, user_blocks,
user_action_rate_limits, moderation_audit_log), auth.uid/auth.jwt helpers,
Supabase Storage schema/service, is_current_user_admin(), existing Auth-to-profile
trigger and Realtime publication. Baseline migrations are NOT reproducible from
empty. Do not run the entire historical migration directory on production.
Confirm `supabase_realtime` includes messages and notifications and that the
Auth profile bootstrap trigger exists; local public-only dumps omitted that
Auth trigger previously. The code assumes valid existing profile rows.

## Exact Story migration order

All seven are required for the final current feature, not just the original three:

1. `20260908072522_add_stories_following_v1.sql`
2. `20260909103246_harden_stories_review.sql`
3. `20260910161733_story_likes_and_reply_notifications.sql` — newer local addition, sorts before the read-RLS fix
4. `20260910162000_fix_story_public_read_rls.sql`
5. `20260911061418_separate_chat_notification_read_state.sql` — newer local addition
6. `20260911061933_open_profile_direct_chat.sql` — newer local addition
7. `20260911064423_harden_story_cleanup_retention.sql` — added by this readiness pass

### Later controlled production procedure — DO NOT execute during this audit

1. Confirm final Windows E2E and freeze the reviewed commit SHA. Download a
   fresh logical backup AND confirm provider backup status/restore procedure.
   Database backups do not contain Storage object bytes; preserve those separately
  and keep cleanup off until backup and rollout are verified. Use a secure local
  directory outside Git; never upload backups as CI artifacts.
2. Use a named libpq service `samosell-production` configured privately from the
   Supabase Connect panel with TLS (`sslmode=verify-full` and the appropriate CA).
   Keep password in the local password file, not shell history. Confirm host/ref
   against `lxsvjzbiuewgwpajqrwr`; pooler user must contain that project ref.
   Record the operator/project/backup timestamp privately. `current_database()`
   is not a project identity proof (many Supabase DBs are named postgres).
3. Read-only commands in PowerShell, from the reviewed repository checkout:

```powershell
psql 'service=samosell-production' -X -v ON_ERROR_STOP=1 -c "select version,name from supabase_migrations.schema_migrations order by version;"
psql 'service=samosell-production' -X -v ON_ERROR_STOP=1 -c "select to_regclass('public.stories'),to_regclass('public.story_upload_plans'),to_regclass('public.story_likes'); select id,public from storage.buckets where id='story-media';"
pg_dump 'service=samosell-production' --format=custom --file='C:\SecureBackups\samosell-pre-stories.dump'
if ($LASTEXITCODE -ne 0) { throw 'Backup failed' }
pg_restore --list 'C:\SecureBackups\samosell-pre-stories.dump'
Get-FileHash 'C:\SecureBackups\samosell-pre-stories.dump' -Algorithm SHA256
```

Do a restore rehearsal into an isolated local database, never over production.
Also export affected function/view/policy definitions before release. Restore
ability, not merely existence of a dump file, is the backup gate.

4. Generate the narrow SQL bundle with `node scripts/build-story-release-sql.mjs`.
   It makes a local `story-release.sql` file only. It contains exactly the seven
   allowlisted migrations, per-step assertions, migration history records and
   one encompassing transaction. The initial public bucket/less restrictive
   policy states are therefore never committed between steps. No production
   connection is made by the generator.
5. At the currently observed empty Story state, review the generated SQL and
   execute only that file in a maintenance window using the verified connection:

```powershell
psql 'service=samosell-production' -X -v ON_ERROR_STOP=1 -f story-release.sql
if ($LASTEXITCODE -ne 0) { throw 'Stop: transaction failed; do not deploy' }
```

The bundle aborts if any Story migration version is already recorded or any
new Story object unexpectedly exists. If inspection finds a partial install,
STOP: compare definitions and migration history, restore/rehearse that actual
schema locally, and prepare a reviewed suffix-only bundle. Do not mark an
unknown object as migrated, reapply CREATE TABLE blindly, drop objects to make
it pass or run `supabase db push`. The all-missing bundle intentionally refuses
partial/drifted states rather than guessing. This snapshot needs all seven.
6. Verify each step's assertions in the transaction and repeat privilege, bucket,
   function and active-read checks after commit. Run Supabase security AND
   performance advisors in the Dashboard/read-only MCP. Compare with baseline;
   investigate new errors, unexpected public grants, missing indexes or RLS.
   Test anonymous Storage INSERT denial and authenticated upload in controlled
   accounts only after the application deployment. Do not delete unrelated data.

## Rollback / incident plan

- DB apply fails: ON_ERROR_STOP and the transaction roll back every Story step.
  Inspect error/schema; fix forward in a local rehearsal before retrying.
- DB succeeds, deploy fails: retain additive tables/media and new compatible
  chat functions. Keep cleanup disabled. Continue serving the prior release and
  verify existing listing chats; fix forward. Do not drop Story tables.
- Deploy succeeds, Story API fails: set server `STORIES_UI_DISABLED=true` and
  redeploy the same reviewed build (hides homepage rail/composer and skips that
  query). This is UI containment only, not revocation of existing auth APIs.
  For broader incidents roll back Vercel to the known-good pre-feature deployment,
  preserve DB/media and stop the workflow. Cached tabs may still call APIs; DB
  auth/RLS remains authoritative. Rotate a compromised cleanup secret immediately.
- Do not undo the PWA fix: never return to the v1 worker that cached unversioned
  Next chunks. If choosing an older deployment, carry the safe worker fix forward.
- A full DB restore is justified only for confirmed data corruption/loss that
  cannot be repaired in place. It rewinds unrelated orders/chats too: freeze
  writes, preserve post-backup data and get explicit incident authorization.
  Storage requires its own recovery; a database restore cannot restore bytes.

## Final Windows two-user E2E — checklist, not an automated PASS claim

Use the user's `C:\Users\www.leptopi.ge\Documents\samosell-local` checkout.
Start Docker Desktop; verify `docker version` and `docker info`; run
`pnpm dlx supabase@latest status` and `pnpm dev` in that folder.
Verify `.env.local` points to `http://127.0.0.1:54321`, never production. Mirror
the reviewed source files and narrowly apply any missing LOCAL Story migrations
before testing; do not reset the existing user dataset. Use two separate browser
profiles, A and B. Record actual outcomes and error logs without secrets.

- A: publish JPG with caption; preview and viewer match; delete a separate Story
  and confirm it disappears. Keep another active Story for the next checks.
- B: view A's Story twice; A's unique view count increases once. Anonymous views
  and listing clicks do not create authenticated analytics rows.
- Follow B→A: counts/list rows update; unfollow works. Profile editor links show
  both lists. Like once/unlike: no reply messages; count belongs to author only.
- Reply B→A on unattached Story: correct direct chat, body and Story context,
  unread mail badge (not general bell). With A's chat already open, another reply
  hydrates realtime context. Older-message pagination retains active context;
  deleted/expired context says `Story აღარ არის ხელმისაწვდომი`, body remains.
- Attach A's active own listing: correct listing opens; reply enters its listing
  chat, never a different seller's. Draft/sold/foreign attachment rejected.
- Mute A via viewer: B's rail excludes A; unmute restores visibility of active
  and future Stories. Previous/next owner controls never display old media under
  a new name when offline/fetch fails.
- Block either direction: no Story visibility, replies, new direct chats or
  normal messages; existing listing pages remain accessible. Unblock works.
- Report: one report per user/Story; admin all/listing/user/story/high/status
  filters consistent, including high-priority reports older than 60 normal ones;
  dismiss/resolve/hide actions behave correctly.
- Media: route gives active RLS-visible media; permanent public Storage URL
  denied; expired/deleted Stories issue no new signed URLs. Already-issued URLs
  may live up to 60 seconds. No private media cached by service worker.
- Video: valid <=15s MP4 and WebM accepted; >15s and unknown duration rejected
  even with spoofed client durationMs. Invalid MIME, oversized image/video,
  wrong owner/path and a second upload using the same plan are rejected.
- Cleanup LOCAL test: use an isolated local fixture, age orphan >2h and expired
  Story >7d, verify active/recent media remains. Never point production cleanup
  route envs at the local server just to bypass its environment guard.

## Recommended release order

1. Final reviewed SHA, automated checks, then complete Windows E2E PASS.
2. Confirm backup and isolated restore rehearsal; freeze DB/application rollout.
3. Re-inspect production identity, migration state and prerequisites (read-only).
4. Apply only reviewed missing Story migrations atomically; verify each step.
5. Post-apply RLS/Storage/config checks and both advisors; stop on new blockers.
6. Provision reviewed Vercel server-only env/secrets with cleanup ENABLED=false;
   do not activate GitHub enable variable yet.
7. User-authorized PR merge, then Vercel production deployment; verify safe PWA.
8. Two controlled production accounts: publish/view/reply/block/report/delete
   smoke test; existing listings and normal chats still work.
9. Only after smoke/backup confirmation: enable Vercel cleanup, configure protected
   GitHub environment, enable workflow variable and observe one bounded run.
10. Monitor for 24–48h: Story action/Storage errors, upload-plan backlog, hourly
    workflow success, atCapacity, unexpected deletion counts, reply/badge errors.
    Logs contain counts/status only. No unattended monitoring was activated by
    this audit. Pause cleanup immediately for anomalous deletion behavior.
