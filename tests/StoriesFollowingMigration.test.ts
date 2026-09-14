import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "20260908072522_add_stories_following_v1.sql"), "utf8")

describe("Stories and Following v1 migration", () => {
  it("enforces follow uniqueness, no self-follow, block checks and authenticated authority", () => {
    expect(sql).toContain("primary key (follower_id, following_id)")
    expect(sql).toContain("user_follows_no_self")
    expect(sql).toContain("interaction_blocked")
    expect(sql).toContain("v_follower_id uuid := auth.uid()")
  })
  it("enforces exact expiry, soft deletion and at most ten active Stories", () => {
    expect(sql).toContain("expires_at = created_at + interval '24 hours'")
    expect(sql).toContain("set deleted_at=coalesce(deleted_at,clock_timestamp())")
    expect(sql).toContain(">= 10")
    expect(sql).toContain("pg_advisory_xact_lock")
  })
  it("derives linked-listing ownership and validates controlled storage metadata", () => {
    expect(sql).toContain("l.seller_id=v_user_id and l.status='active'")
    expect(sql).toContain("storage.objects")
    expect(sql).toContain("invalid_story_media_path")
    expect(sql).toContain("invalid_story_media_type")
  })
  it("keeps views unique, rejects self views, and excludes mute/block relations", () => {
    expect(sql).toContain("primary key (story_id, viewer_id)")
    expect(sql).toContain("if not found or v_owner_id=v_user_id then return false")
    expect(sql).toContain("public.story_mutes")
    expect(sql).toContain("public.user_blocks")
  })
  it("generalizes chat with database invariants and one canonical direct pair", () => {
    expect(sql).toContain("chats_type_integrity_check")
    expect(sql).toContain("chat_type = 'direct' and listing_id is null")
    expect(sql).toContain("chats_direct_canonical_pair_unique_idx")
    expect(sql).toContain("least(buyer_id::text, seller_id::text)")
  })
  it("routes replies authoritatively and keeps request ids idempotent", () => {
    expect(sql).toContain("public.reply_to_story")
    expect(sql).toContain("self_story_reply")
    expect(sql).toContain("story_unavailable")
    expect(sql).toContain("on conflict(sender_id,client_request_id)")
    expect(sql).toContain("'story_reply',p_story_id")
  })
  it("supports reports, audited moderation, owner-only analytics and delayed cleanup", () => {
    expect(sql).toContain("public.submit_story_report")
    expect(sql).toContain("public.review_story_report")
    expect(sql).toContain("insert into public.moderation_audit_log")
    expect(sql).toContain("public.get_my_story_stats")
    expect(sql).toContain("now()-interval '7 days'")
  })
  it("keeps direct writes revoked while exposing narrow RPCs", () => {
    expect(sql).toContain("revoke all on table public.stories from public, anon, authenticated")
    expect(sql).toContain("grant execute on function public.create_story")
    expect(sql).toContain("grant execute on function public.reply_to_story")
  })
})
