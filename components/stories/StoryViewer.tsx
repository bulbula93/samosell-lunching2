"use client"
/* eslint-disable @next/next/no-img-element -- Full-size Story media is delivered directly by Supabase Storage for cost control. */

import Link from "next/link"
import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import Avatar from "@/components/shared/Avatar"
import {
  deleteStoryAction,
  blockStoryOwnerAction,
  recordStoryListingClickAction,
  recordStoryViewAction,
  replyToStoryAction,
  reportStoryAction,
  setStoryMuteAction,
  setStoryLikedAction,
} from "@/app/stories/actions"
import { formatRelativeStoryTime, STORY_IMAGE_AUTO_ADVANCE_MS } from "@/lib/stories"
import type { StoryItem, StoryOwner } from "@/types/story"

type Props = {
  owners: StoryOwner[]
  initialOwnerIndex: number
  currentUserId: string | null
  onClose: () => void
}

export default function StoryViewer({ owners, initialOwnerIndex, currentUserId, onClose }: Props) {
  const [ownerIndex, setOwnerIndex] = useState(initialOwnerIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [stories, setStories] = useState<StoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [paused, setPaused] = useState(false)
  const [reply, setReply] = useState("")
  const [notice, setNotice] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const [videoMuted, setVideoMuted] = useState(true)
  const [likePending, setLikePending] = useState(false)
  const [pending, startTransition] = useTransition()
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const owner = owners[ownerIndex]
  const story = stories[storyIndex]

  const move = useCallback((direction: 1 | -1) => {
    if (pending || loading) return
    setMenuOpen(false)
    const next = storyIndex + direction
    if (next >= 0 && next < stories.length) { setStoryIndex(next); return }
    const nextOwner = ownerIndex + direction
    if (nextOwner < 0) { setStoryIndex(0); return }
    if (nextOwner >= owners.length) { onClose(); return }
    setLoading(true)
    setStories([])
    setNotice("")
    setStoryIndex(direction > 0 ? 0 : -1)
    setOwnerIndex(nextOwner)
  }, [onClose, ownerIndex, owners.length, stories.length, storyIndex, pending, loading])

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    closeButtonRef.current?.focus()
    return () => { document.body.style.overflow = previousOverflow }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch(`/api/stories/${encodeURIComponent(owner.id)}`, { cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("story_load_failed")))
      .then((payload: { stories?: StoryItem[] }) => {
        if (cancelled) return
        const nextStories = payload.stories ?? []
        setStories(nextStories)
        setStoryIndex((current) => current < 0 ? Math.max(0, nextStories.length - 1) : Math.max(0, nextStories.findIndex((item) => !item.viewed)))
        setLoading(false)
      })
      .catch(() => { if (!cancelled) { setStories([]); setNotice("Story ვერ ჩაიტვირთა"); setLoading(false) } })
    return () => { cancelled = true }
  }, [owner.id])

  useEffect(() => {
    if (!story) return
    void recordStoryViewAction(story.id)
  }, [story])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key === "ArrowRight") move(1)
      if (event.key === "ArrowLeft") move(-1)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [move, onClose])

  useEffect(() => {
    if (!story || story.mediaType !== "image" || paused || pending || menuOpen || loading) return
    const timer = window.setTimeout(() => move(1), STORY_IMAGE_AUTO_ADVANCE_MS)
    return () => window.clearTimeout(timer)
  }, [move, paused, story, pending, menuOpen, loading])

  function deleteCurrentStory() {
    if (!story || currentUserId !== owner.id || pending || loading) return
    if (!window.confirm("წავშალოთ ეს Story?")) return
    const storyId = story.id
    setNotice("")
    startTransition(async () => {
      try {
        const result = await deleteStoryAction(storyId)
        if (result.ok) onClose()
        else setNotice(result.message)
      } catch {
        setNotice("Story ვერ წაიშალა. სცადე ხელახლა.")
      }
    })
  }

  function sendReply(body: string) {
    if (!story || !currentUserId || !body.trim()) return
    setNotice("")
    startTransition(async () => {
      const result = await replyToStoryAction({ storyId: story.id, body: body.trim(), clientRequestId: crypto.randomUUID() })
      if (result.ok) {
        setReply("")
        setNotice("პასუხი გაიგზავნა")
      } else setNotice(result.message)
    })
  }

  async function toggleLike() {
    if (!story || !currentUserId || currentUserId === owner.id || pending || likePending) return
    const storyId = story.id
    const liked = !story.liked
    setNotice("")
    setLikePending(true)
      try {
        const result = await setStoryLikedAction(storyId, liked)
        if (result.ok) setStories((items) => items.map((item) => item.id === storyId ? { ...item, liked: result.liked } : item))
        else setNotice(result.message)
      } catch { setNotice("მოწონება ვერ შეიცვალა. სცადე ხელახლა.") }
      finally { setLikePending(false) }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={`${owner.username}-ის Story`} className="fixed inset-0 z-[100] bg-black/95 text-white">
      <div className="mx-auto flex h-full max-w-[520px] flex-col px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-[max(12px,env(safe-area-inset-top))]">
        <div className="flex gap-1" aria-label="Story პროგრესი">
          {stories.map((item, index) => <span key={item.id} className={`h-1 flex-1 rounded-full ${index <= storyIndex ? "bg-white" : "bg-white/30"}`} />)}
        </div>
        <header className="mt-3 flex items-center gap-3">
          <Avatar src={owner.avatarUrl} alt={owner.username} fallbackText={owner.fullName || owner.username} sizeClassName="h-10 w-10" />
          <div className="min-w-0 flex-1"><Link href={`/seller/${encodeURIComponent(owner.username)}`} onClick={onClose} className="block w-fit max-w-full truncate rounded text-sm font-black hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{owner.username}</Link>{story ? <p className="text-xs text-white/65">{formatRelativeStoryTime(story.createdAt)}</p> : null}</div>
          {currentUserId === owner.id && story && !loading ? <button type="button" disabled={pending} aria-label="Story-ის წაშლა" onClick={deleteCurrentStory} className="rounded-full bg-red-500/15 px-3 py-2 text-xs font-bold text-red-200 hover:bg-red-500/30 disabled:opacity-50">{pending ? "იცადე…" : "წაშლა"}</button> : null}
          <button type="button" aria-label="Story მენიუ" onClick={() => setMenuOpen((value) => !value)} className="rounded-full px-3 py-2 text-xl">•••</button>
          <button ref={closeButtonRef} type="button" aria-label="Story-ის დახურვა" onClick={onClose} className="rounded-full px-3 py-2 text-2xl">×</button>
        </header>
        {menuOpen ? (
          <div className="absolute right-4 top-20 z-20 w-56 rounded-2xl bg-white p-2 text-sm text-text shadow-2xl">
            <Link href={`/seller/${encodeURIComponent(owner.username)}`} className="block rounded-xl px-3 py-2 hover:bg-neutral-100">პროფილის ნახვა</Link>
            {currentUserId && currentUserId !== owner.id ? <button className="block w-full rounded-xl px-3 py-2 text-left hover:bg-neutral-100" onClick={() => startTransition(async () => { await setStoryMuteAction(owner.id, true); onClose() })}>Stories-ის დადუმება</button> : null}
            {currentUserId && currentUserId !== owner.id && story ? <><button className="block w-full rounded-xl px-3 py-2 text-left text-red-700 hover:bg-red-50" onClick={() => setReportOpen((value) => !value)}>რეპორტი</button>{reportOpen ? <div className="border-t border-line pt-2">{[["spam","სპამი"],["scam","თაღლითობა"],["harassment","შეურაცხყოფა"],["nudity","შეუსაბამო სიშიშვლე"],["prohibited","აკრძალული ნივთი"],["other","სხვა"]].map(([reason,label]) => <button key={reason} className="block w-full rounded-lg px-3 py-1.5 text-left text-xs hover:bg-neutral-100" onClick={() => startTransition(async () => { const result = await reportStoryAction({ storyId: story.id, reason }); setNotice(result.ok ? "რეპორტი გაიგზავნა" : result.message); setMenuOpen(false); setReportOpen(false) })}>{label}</button>)}</div> : null}</> : null}
            {currentUserId && currentUserId !== owner.id ? <button className="block w-full rounded-xl px-3 py-2 text-left text-red-700 hover:bg-red-50" onClick={() => startTransition(async () => { const result = await blockStoryOwnerAction(owner.id); if (result.ok) onClose(); else setNotice(result.message) })}>მომხმარებლის დაბლოკვა</button> : null}
          </div>
        ) : null}
        <div className="relative mt-3 min-h-0 flex-1 overflow-hidden rounded-[28px] bg-neutral-900" onPointerDown={() => { setPaused(true); videoRef.current?.pause() }} onPointerUp={() => { setPaused(false); void videoRef.current?.play() }}>
          {loading ? <div className="flex h-full items-center justify-center text-sm text-white/70">იტვირთება…</div> : story ? (
            <>
              {story.mediaType === "image" ? <>{/* Story media intentionally bypasses Vercel image transformations. */}<img src={story.mediaUrl} alt={story.caption || `${owner.username}-ის Story`} className="h-full w-full object-cover" /></> : <><video ref={videoRef} src={story.mediaUrl} autoPlay playsInline muted={videoMuted} onEnded={() => move(1)} className="h-full w-full object-cover" aria-label={story.caption || `${owner.username}-ის ვიდეო Story`} /><button type="button" onClick={() => setVideoMuted((value) => !value)} className="absolute right-3 top-3 z-10 rounded-full bg-black/55 px-3 py-2 text-xs font-bold" aria-label={videoMuted ? "ვიდეოს ხმის ჩართვა" : "ვიდეოს ხმის გამორთვა"}>{videoMuted ? "ხმა გამორთულია" : "ხმა ჩართულია"}</button></>}
              <button type="button" aria-label="წინა Story" disabled={pending || (ownerIndex === 0 && storyIndex === 0)} onClick={() => move(-1)} className="absolute left-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/55 text-3xl shadow-lg backdrop-blur-sm hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-25"><span aria-hidden="true">‹</span></button>
              <button type="button" aria-label="შემდეგი Story" disabled={pending} onClick={() => move(1)} className="absolute right-3 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-black/55 text-3xl shadow-lg backdrop-blur-sm hover:bg-black/75 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-25"><span aria-hidden="true">›</span></button>
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-5 pt-20">
                {story.caption ? <p className="text-sm leading-6">{story.caption}</p> : null}
                {story.linkedListing ? story.linkedListing.status === "active" ? (
                  <Link href={`/listing/${story.linkedListing.slug}`} onClick={() => { void recordStoryListingClickAction(story.id); onClose() }} className="pointer-events-auto mt-4 flex items-center gap-3 rounded-2xl bg-white/95 p-3 text-text">
                    {story.linkedListing.coverImageUrl ? <img src={story.linkedListing.coverImageUrl} alt="" className="h-14 w-12 shrink-0 rounded-lg object-cover" /> : null}<span className="min-w-0 flex-1"><span className="text-xs font-bold text-brand">ნახე ნივთი →</span><span className="mt-1 block truncate font-black">{story.linkedListing.title}</span><span className="block text-sm">{story.linkedListing.price} {story.linkedListing.currency}</span></span>
                  </Link>
                ) : <div className="mt-4 rounded-2xl bg-white/90 p-3 text-sm text-text-soft">ნივთი აღარ არის ხელმისაწვდომი</div> : null}
              </div>
            </>
          ) : <div className="flex h-full items-center justify-center">Story აღარ არის ხელმისაწვდომი</div>}
        </div>
        {story && currentUserId && currentUserId !== owner.id ? (
          <div className="mt-3 flex items-center gap-2">
            <form className="flex min-w-0 flex-1" onSubmit={(event) => { event.preventDefault(); sendReply(reply) }}><input value={reply} onChange={(event) => setReply(event.target.value)} maxLength={2000} placeholder="უპასუხე Story-ს" aria-label="Story პასუხი" className="min-h-11 min-w-0 flex-1 rounded-full border border-white/25 bg-white/10 px-4 text-sm outline-none placeholder:text-white/55" /></form>
            <button type="button" disabled={pending || likePending} onClick={toggleLike} aria-pressed={Boolean(story.liked)} aria-label={story.liked ? "Story-ის მოწონების გაუქმება" : "Story-ის მოწონება"} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-3xl transition-colors disabled:opacity-50 ${story.liked ? "text-red-400" : "text-white"}`}><span aria-hidden="true">{story.liked ? "♥" : "♡"}</span></button>
          </div>
        ) : !currentUserId ? <Link href="/login?next=%2F" className="mt-3 text-center text-sm font-bold underline">პასუხისთვის გაიარე ავტორიზაცია</Link> : null}
        {notice ? <p role="status" className="mt-2 text-center text-xs text-white/80">{notice}</p> : null}
        {story && currentUserId === owner.id ? <p className="mt-3 text-center text-sm text-white/85" aria-label="Story-ის მოწონებების რაოდენობა"><span className="text-red-400" aria-hidden="true">♥</span> {story.likeCount ?? 0} მოწონება</p> : null}
      </div>
    </div>
  )
}
