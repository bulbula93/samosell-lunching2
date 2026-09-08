"use client"

import Link from "next/link"
import { useRef, useState } from "react"
import Avatar from "@/components/shared/Avatar"
import StoryComposer from "@/components/stories/StoryComposer"
import StoryViewer from "@/components/stories/StoryViewer"
import type { StoryRailData } from "@/types/story"

export default function StoriesRail({ data }: { data: StoryRailData }) {
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)
  const [composerOpen, setComposerOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  if (!data.currentUserId && data.owners.length === 0) return null
  return <section aria-label="Stories" className="border-b border-line bg-white py-4 sm:py-5"><div className="ui-container"><div className="flex gap-4 overflow-x-auto pb-1 [scrollbar-width:none]">
    <div className="w-[72px] shrink-0 text-center">
      {data.currentUserId ? <button type="button" onClick={() => setComposerOpen(true)} className="group" aria-label="Story-ის დამატება"><span className="relative inline-block"><Avatar alt="Your Story" fallbackText="+" sizeClassName="h-16 w-16" textClassName="text-xl" /><span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-brand text-lg text-white">+</span></span><span className="mt-2 block truncate text-xs font-bold">შენი Story</span></button> : <Link href="/login?next=%2F" className="block"><Avatar alt="შესვლა" fallbackText="+" sizeClassName="h-16 w-16" /><span className="mt-2 block text-xs font-bold">Story +</span></Link>}
    </div>
    {data.owners.map((owner, index) => <button type="button" key={owner.id} onClick={(event) => { triggerRef.current = event.currentTarget; setViewerIndex(index) }} className="w-[72px] shrink-0 text-center" aria-label={`${owner.username}-ის Story`}><span className={`inline-flex rounded-full p-0.5 ${owner.unseenCount > 0 ? "bg-gradient-to-tr from-brand via-emerald-400 to-amber-300" : "bg-neutral-300"}`}><span className="rounded-full bg-white p-0.5"><Avatar src={owner.avatarUrl} alt={owner.username} fallbackText={owner.fullName || owner.username} sizeClassName="h-[58px] w-[58px]" /></span></span><span className="mt-2 block truncate text-xs font-semibold">{owner.username}</span></button>)}
  </div>{data.ownStats && data.owners.some((owner) => owner.id === data.currentUserId) ? <p className="mt-2 text-xs text-text-soft">შენი Stories · ნახვები {data.ownStats.views} · პასუხები {data.ownStats.replies} · ნივთზე გადასვლა {data.ownStats.listingClicks}</p> : null}</div>
  {viewerIndex !== null ? <StoryViewer owners={data.owners} initialOwnerIndex={viewerIndex} currentUserId={data.currentUserId} onClose={() => { setViewerIndex(null); window.setTimeout(() => triggerRef.current?.focus(), 0) }} /> : null}
  {composerOpen ? <StoryComposer listings={data.composerListings} onClose={() => setComposerOpen(false)} /> : null}
  </section>
}
