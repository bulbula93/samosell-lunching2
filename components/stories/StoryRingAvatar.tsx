"use client"

import { useRef, useState } from "react"
import Avatar from "@/components/shared/Avatar"
import StoryViewer from "@/components/stories/StoryViewer"
import type { StoryOwner } from "@/types/story"

export default function StoryRingAvatar({ owner, currentUserId, sizeClassName = "h-20 w-20", textClassName = "text-2xl" }: { owner: StoryOwner; currentUserId: string | null; sizeClassName?: string; textClassName?: string }) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  return <><button ref={triggerRef} type="button" onClick={() => setOpen(true)} aria-label={`${owner.username}-ის Story-ის ნახვა`} className="shrink-0 rounded-full bg-gradient-to-tr from-brand via-emerald-400 to-amber-300 p-1"><span className="block rounded-full bg-white p-0.5"><Avatar src={owner.avatarUrl} alt={owner.username} fallbackText={owner.fullName || owner.username} sizeClassName={sizeClassName} textClassName={textClassName} /></span></button>{open ? <StoryViewer owners={[owner]} initialOwnerIndex={0} currentUserId={currentUserId} onClose={() => { setOpen(false); window.setTimeout(() => triggerRef.current?.focus(), 0) }} /> : null}</>
}
