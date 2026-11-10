# SamoSell TikTok Draft Agent — QA Preview v1

## Scope / non-goals
- Requested policy: **three weekly drafts**, **mixed topics**, **draft only**.
- Never publishes, uploads, invokes TikTok APIs, schedules background work, purchases ads, or writes to Production.
- No TikTok credentials or new dependencies required. **No MP4 rendering in this v1**; output is a render-ready 9:16 three-scene storyboard manifest, with 13s duration and Georgian captions.
- Sources: read-only listing candidates from the existing `createSocialStore` adapter, using existing environment gate. If unavailable, evergreen copy replaces product claims. Simulation fixtures are not represented as real listings.
- Visible at `/admin/social/tiktok` after administrator authentication in **Preview/development only**. Branch is intentionally not merged to `main`.

## Integration with existing Meta Social Media Agent OS
- Existing `SocialPlatform` stays `instagram | facebook`; `tiktokEnabled: false` remains unchanged.
- Existing Meta `social_posts`, `social_publish_jobs`, approval queue, adapters, RLS and worker remain unchanged.
- TikTok has a *separate* `lib/tiktok/draft-agent.ts` output type. All effectful TikTok actions are denied by `assertTikTokActionAllowed`. No TikTok API client or database mutation exists.
- The listing DTO `CandidateListing` and existing QA-only store are reused. User-visible draft preview is linked from `/admin/social`.
- The QA check is TikTok-specific and covers false claims, personal data and media origins. Meta-specific JPEG/carousel rules are deliberately not reused.

## Weekly cadence (Asia/Tbilisi)
- Tuesday 19:00 — featured listing (if valid QA candidate; otherwise evergreen)
- Thursday 19:00 — practical selling tips
- Saturday 18:00 — brand awareness
- 1080×1920, 30fps manifest, 4+5+4 seconds, no audio asset until licensed.

## Validation
- `pnpm exec vitest run tests/TikTokDraftAgent.test.ts`
- `pnpm exec tsc --noEmit`
- `pnpm lint`
- `pnpm build`
- Verify admin page renders in Preview; verify production guard is fail-closed.
- CI/Preview evidence must be checked separately. Do **not** claim the video was rendered or published from storyboard data.

## Further work (separate approved phase)
1. Add reliable server-side MP4 renderer (e.g., FFmpeg worker), fixed typography/branding, safe media ingestion, audio licensing, previews and asset retention limits.
2. Implement QA-only persistent draft store with versioned review/approval and delete controls, isolated from Meta queue.
3. Only after user authorizes TikTok connection: review TikTok Content Posting API availability, app permissions and platform audits. Keep any upload disabled until an explicitly authorized phase.
4. Observe CPU/time/storage costs before rendering videos on Vercel; consider offline/batch renderer to protect free-tier resources.
