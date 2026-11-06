import "server-only"
import { createHash } from "node:crypto"
import { getPublicEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { convertToInstagramJpeg, createMediaPreparer, MediaPrepareError, SOCIAL_MEDIA_BUCKET, type MediaPreparer } from "./media"
import type { SocialRuntime } from "./runtime"

/** Fail-closed: no preparer unless the runtime allows the social backend. */
export function createSocialMediaPreparer(runtime: SocialRuntime): MediaPreparer | null {
  if (!runtime.backendAllowed) return null
  const db = createAdminClient()
  return createMediaPreparer({
    supabaseUrl: getPublicEnv().supabaseUrl,
    fetcher: fetch,
    convert: convertToInstagramJpeg,
    digest: input => createHash("sha256").update(input).digest("hex").slice(0, 40),
    upload: async (path, body) => {
      const { error } = await db.storage.from(SOCIAL_MEDIA_BUCKET).upload(path, body, { contentType: "image/jpeg", cacheControl: "31536000", upsert: true })
      if (error) throw new MediaPrepareError("media_upload_failed")
    },
  })
}
