import { buildTikTokLiveUrl, isTikTokLiveActive } from "@/lib/tiktok"

export default function TikTokLiveBadge({
  username,
  liveUntil,
  className = "",
}: {
  username?: string | null
  liveUntil?: string | null
  className?: string
}) {
  const href = buildTikTokLiveUrl(username)
  if (!href || !isTikTokLiveActive(liveUntil)) return null

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`@${username} TikTok LIVE-ის გახსნა`}
      title="TikTok LIVE-ის გახსნა"
      className={`inline-flex min-h-7 items-center gap-1 rounded-full border-2 border-white bg-[#ff2d55] px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em] text-white shadow-[0_5px_16px_rgba(255,45,85,0.35)] transition hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#ff2d55] ${className}`}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
      LIVE
    </a>
  )
}
