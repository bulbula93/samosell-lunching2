/* eslint-disable @next/next/no-img-element -- Admin previews must show the exact media URL Meta will fetch, without an extra Vercel image transform. */
import { renderCaption, SITE_ORIGIN } from "@/lib/social/agents/creative"
import type { SocialPlatform, SocialPost } from "@/lib/social/types"

/** samosell.ge assets are shown same-origin so Preview deployments render files that are not in Production yet. */
export function displaySrc(url: string) {
  return url.startsWith(`${SITE_ORIGIN}/`) ? url.slice(SITE_ORIGIN.length) : url
}

function Media({ post }: { post: SocialPost }) {
  const src = post.mediaUrls[0] ? displaySrc(post.mediaUrls[0]) : undefined
  if (!src) return <div className="flex aspect-square items-center justify-center bg-surface-alt text-xs text-text-soft">სურათი არ არის</div>
  return (
    <div className="relative aspect-square overflow-hidden bg-surface-alt">
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      {post.mediaUrls.length > 1 ? <span className="absolute right-2 top-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-white">1/{post.mediaUrls.length}</span> : null}
    </div>
  )
}

export function PlatformPreview({ post, platform }: { post: SocialPost; platform: SocialPlatform }) {
  const text = renderCaption(post, platform)
  if (platform === "instagram") {
    return (
      <figure className="w-full max-w-[300px] overflow-hidden rounded-xl border bg-white text-[13px] text-black" aria-label="Instagram preview">
        <div className="flex items-center gap-2 px-3 py-2 font-semibold"><span className="h-6 w-6 rounded-full bg-gradient-to-tr from-amber-400 to-fuchsia-600" />samo.sell</div>
        <Media post={post} />
        <figcaption className="max-h-40 overflow-y-auto whitespace-pre-line px-3 py-2"><b>samo.sell</b> {text}</figcaption>
      </figure>
    )
  }
  return (
    <figure className="w-full max-w-[300px] overflow-hidden rounded-xl border bg-white text-[13px] text-black" aria-label="Facebook preview">
      <div className="flex items-center gap-2 px-3 py-2"><span className="h-7 w-7 rounded-full bg-[#1877f2]" /><div><b>SamoSell</b><div className="text-[11px] text-gray-500">დაგეგმილი · 🌐</div></div></div>
      <figcaption className="max-h-40 overflow-y-auto whitespace-pre-line px-3 pb-2">{text}</figcaption>
      <Media post={post} />
    </figure>
  )
}
