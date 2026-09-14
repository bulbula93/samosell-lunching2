# PR #4 security hardening

This records the earlier security-review baseline. For the current seven-migration
release, disabled production cleanup and final rollout/rollback procedure, use
[STORIES-PRODUCTION-RELEASE.md](./STORIES-PRODUCTION-RELEASE.md).

Scope: `feature/stories-following-v1`. No merge, deployment, production migration, or payment/TBC changes.

## Review fixes

1. **Storage upload bypass**: browser INSERT/UPDATE/DELETE denied with restrictive bucket-scoped RLS. Authenticated `prepare_story_upload` derives `auth.uid()`, creates a random exact path, and atomically charges the 20/hour quota. Only the server signs the upload, without upsert. A Storage trigger checks the plan's 10-minute deadline, exact MIME/byte size and max-age=0 cache policy, revocation and single use, including privileged signed uploads. Storage permission preflights (no final `size`) run inside rollback transactions; actual uploads consume the plan. Objects cannot be replaced or renamed after upload.
2. **Anonymous clicks**: anon has neither INSERT nor RPC EXECUTE. The RPC rejects missing users and anonymous Auth sessions, suspended users, owner self-clicks and either-direction blocks. The existing unique `(story_id,user_id)` index allows one interaction per authenticated viewer per Story. Client input contains only Story ID; listing/owner identities come from the database. Historical NULL-user rows are excluded from statistics without deleting data. Multiple colluding real accounts remain outside the scope of v1 anti-fraud.
3. **Video duration**: pinned `mediabunny` 1.56.0 is pure JavaScript, with MP4/WebM parsers only and no decoding/transcoding binary. Publish scans packet timestamps/durations across every track, rejects unknown/live/empty/non-finite/non-positive durations and over-15-second media, and bounds track and packet counts. Client `durationMs` is ignored. A server-only validation attestation is required by the `create_story` RPC, so direct RPC invocation cannot bypass media validation. Magic bytes and exact size/MIME checks remain. Some files without trustworthy per-packet duration (including some WebM recordings) fail closed and must be exported with valid timing metadata.
4. **Chat history**: initial and older-message loaders share one RLS-aware batch context query. Explicit active/non-deleted predicates prevent owner/admin policies from reviving unavailable Story context. Missing Story or inaccessible listing yields the existing safe context; message body and cursor ordering are preserved.
5. **Moderation filters**: Story reports join the same sorted, limited queue before kind and high-priority filtering. Status applies to every report query. Stories have a kind tab and use the existing risk model (`nudity`, `scam`, `harassment`, `prohibited` are high). Empty state derives from the final queue. Summary status counts include Stories. Completed Story reports have no active moderation form.

## Additional security audit

- Story creation retains its DB advisory lock, maximum ten active Stories, 20/hour publication quota, authoritative seller ownership and 24-hour expiry.
- Views have authenticated-only RPC access, unique `(story_id,viewer_id)` and self/block exclusions.
- Story replies retain active/suspended-owner checks, participant derivation, either-direction block checks, deduplication and message rate limiting. Added restrictive INSERT policy prevents users fabricating Story replies directly in `messages`; regular text messages keep their existing policies.
- Direct chat INSERT remains disallowed by the listing-only policy. Only the checked reply RPC can create direct chats, with canonical-pair uniqueness. Existing participant RLS controls messages and chat reads.
- Story reporting keeps authenticated reporter identity, per-user rate limiting and unique reporter/story rows. Admin mutations require `is_current_user_admin()` and retain audit logging and terminal-state checks.
- Private Storage replaces indefinitely valid public media URLs. `/api/stories/media/[storyId]` checks caller RLS and active state on each request before issuing a no-store redirect. Signed asset lifetime is at most 60 seconds and never later than Story expiry. A URL already issued before deletion/block can remain usable for that bounded window; previously downloaded bytes cannot be recalled. Owner/admin access to retained media remains intentional.
- Cleanup scans actual Storage objects, so pre-plan and abandoned upload orphans are included. Abort atomically revokes an unpublished plan before deleting bytes; racing successful publications cannot be removed by abort. Expired orphan paths cannot become new publications while cleanup runs.
- All new definer functions have an empty search path and explicit grants/revocations. Plan rows use RLS; browser roles cannot write validation attestations. No service-role key is returned to clients.

## Staging procedure (required before merge)

No linked Samosell staging project or local Docker Supabase service was available during this task. Only the production Samosell project was listed. No remote schema was changed and no production advisors were substituted for staging validation.

1. Create/use an isolated staging project with the baseline schema. Apply the original Stories migration followed by `20260909103246_harden_stories_review.sql`. Never apply these commands to the production ref `lxsvjzbiuewgwpajqrwr` during this review.
2. Run `StorySecurityDatabase.test.ts` locally; these execute PostgreSQL RLS and triggers in PGlite against representative auth/storage tables, not the hosted Storage service.
3. On actual staging Storage, test anonymous/direct authenticated POST, signed URL creation by browser (denied), signed upload via server plan (allowed), mismatched MIME/size/path (denied), expired plan (denied), second upload and replacement (denied). This verifies the deployed Storage service's preflight/final-write behavior with the trigger.
4. Publish known 15-second and 16-second MP4/WebM files, including forged client duration; attempt direct `create_story` without attestation. Verify genuine browser-produced supported files; unknown timing must stay rejected.
5. Test anonymous listing navigation without any click row; authenticated repeated and owner clicks; blocks in both directions; active/expired/deleted Story context on both initial and older chat pages; all moderation filter combinations.
6. Test public media URLs are denied, active signed delivery works, and new media URLs are denied after deletion/expiry/block. Admin retained-media previews must remain accessible.
7. Configure an hourly trusted staging job for `scripts/cleanup-story-media.mjs`. Supply `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and matching `STORY_CLEANUP_PROJECT_REF`. Run once without flags (dry-run), then with `--apply`. It removes at most 500 eligible objects per run using the Storage API and prunes old unpublished plans. Failed removals remain eligible for retry. The script explicitly rejects the production project; no scheduler is activated by this PR.
8. Run Supabase security/performance advisors on that staging project and inspect the new plan/query indexes and policies. Validate full migration compatibility and actual Storage behavior before merge.

## Validation

Node 22.23.2: frozen install, TypeScript, full ESLint and production build passed. Full suite: 76 files, 400 tests passed. The targeted Story/chat suite passed; PostgreSQL integration includes nine security-boundary cases. See the PR update for the commit SHA. Regression coverage includes actual PostgreSQL policy/trigger execution, spoofed-duration publish actions, synthetic MP4/WebM containers, chat pagination and batch hydration, and rendered moderation filters. The tests do not claim hosted Storage, browser end-to-end, or staging migration verification.
