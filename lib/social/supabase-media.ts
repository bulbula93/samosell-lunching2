import "server-only"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { getPublicEnv } from "@/lib/env"
import { createAdminClient } from "@/lib/supabase/admin"
import { convertToInstagramJpeg, createMediaPreparer, createStoryPreparer, MediaPrepareError, SOCIAL_MEDIA_BUCKET, type MediaPreparer, type StoryAssets, type StoryPreparer } from "./media"
import type { SocialRuntime } from "./runtime"

function storageDeps() {
  const db = createAdminClient()
  return {
    supabaseUrl: getPublicEnv().supabaseUrl,
    fetcher: fetch,
    digest: (input: string) => createHash("sha256").update(input).digest("hex").slice(0, 40),
    upload: async (objectPath: string, body: Uint8Array) => {
      const { error } = await db.storage.from(SOCIAL_MEDIA_BUCKET).upload(objectPath, body, { contentType: "image/jpeg", cacheControl: "31536000", upsert: true })
      if (error) throw new MediaPrepareError("media_upload_failed")
    },
  }
}

/** Fail-closed: no preparer unless the runtime allows the social backend. */
export function createSocialMediaPreparer(runtime: SocialRuntime): MediaPreparer | null {
  if (!runtime.backendAllowed) return null
  return createMediaPreparer({ ...storageDeps(), convert: convertToInstagramJpeg })
}

const ASSETS = path.join(process.cwd(), "lib", "social", "assets")
let assetsPromise: Promise<StoryAssets> | null = null
function loadStoryAssets(): Promise<StoryAssets> {
  assetsPromise ??= readFile(path.join(ASSETS, "logo-520.png"))
    .then(logo => ({ logo: new Uint8Array(logo), fontBold: path.join(ASSETS, "FiraGO-ExtraBold.ttf"), fontMedium: path.join(ASSETS, "FiraGO-Medium.ttf") }))
    .catch(() => { assetsPromise = null; throw new MediaPrepareError("story_assets_missing") })
  return assetsPromise
}

export function createSocialStoryPreparer(runtime: SocialRuntime): StoryPreparer | null {
  if (!runtime.backendAllowed) return null
  return createStoryPreparer({ ...storageDeps(), assets: loadStoryAssets })
}
