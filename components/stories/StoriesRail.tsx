"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import Avatar from "@/components/shared/Avatar"
import StoryComposer from "@/components/stories/StoryComposer"
import StoryViewer from "@/components/stories/StoryViewer"
import StoryCardPreview from "@/components/stories/StoryCardPreview"
import type { StoryRailData } from "@/types/story"

export default function StoriesRail({ data }: { data: StoryRailData }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  if (!data.currentUserId && data.owners.length === 0) return null
  return <section aria-label="Stories" className="border-b border-line bg-white py-4 sm:py-5"><div className="ui-container"><div className="flex gap-3 overflow-x-auto px-0.5 py-1 [scrollbar-width:none]">
    {data.currentUserId ? <button type="button" onClick={() => setComposerOpen(true)} className="flex aspect-[2/3] w-28 shrink-0 flex-col items-center justify-center gap-3 rounded-2xl border border-brand/20 bg-brand-soft/50 p-3 text-brand transition-colors hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-32" aria-label="Story-ის დამატება"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-3xl shadow-sm" aria-hidden="true">+</span><span className="text-xs font-bold">შენი Story</span></button> : <Link href="/login?next=%2F" className="flex aspect-[2/3] w-28 shrink-0 flex-col items-center justify-center gap-3 rounded-2xl border border-brand/20 bg-brand-soft/50 text-brand sm:w-32"><span className="text-3xl" aria-hidden="true">+</span><span className="text-xs font-bold">Story +</span></Link>}
    {data.owners.map((owner, index) => <button type="button" key={owner.id} onClick={(event) => { triggerRef.current = event.currentTarget; setViewerIndex(index) }} className={`group relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-2xl bg-neutral-800 text-left text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:w-32 ${owner.unseenCount > 0 ? "ring-2 ring-brand ring-offset-2" : "ring-1 ring-black/10"}`} aria-label={`${owner.username}-ის Story`}>
      <span className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-brand to-neutral-900"><Avatar src={owner.avatarUrl} alt="" fallbackText={owner.fullName || owner.username} sizeClassName="h-16 w-16" /></span>
      {owner.preview ? <StoryCardPreview key={owner.preview.storyId} preview={owner.preview} /> : null}
      <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-black/20" aria-hidden="true" />
      <span className="absolute right-2 top-2 rounded-full bg-black/35 px-2 py-0.5 text-[10px] font-bold backdrop-blur-sm">{owner.preview?.mediaType === "video" ? "▶ " : ""}{owner.storyCount}</span>
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-1.5 p-2.5"><span className="w-fit rounded-full ring-2 ring-white/90"><Avatar src={owner.avatarUrl} alt="" fallbackText={owner.fullName || owner.username} sizeClassName="h-7 w-7" textClassName="text-[10px]" /></span><span className="block truncate text-xs font-bold">{owner.username}</span></span>
    </button>)}
  </div>{data.ownStats && data.owners.some((owner) => owner.id === data.currentUserId) ? <p className="mt-2 text-xs text-text-soft">შენი Stories · ნახვები {data.ownStats.views} · პასუხები {data.ownStats.replies} · ნივთზე გადასვლა (მხოლოდ ავტორიზებული მომხმარებლები) {data.ownStats.listingClicks}</p> : null}</div>
  {viewerIndex !== null ? <StoryViewer owners={data.owners} initialOwnerIndex={viewerIndex} currentUserId={data.currentUserId} onClose={() => { setViewerIndex(null); window.setTimeout(() => triggerRef.current?.focus(), 0) }} /> : null}
  {composerOpen ? <StoryComposer listings={data.composerListings} onClose={() => setComposerOpen(false)} /> : null}
  </section>
}
