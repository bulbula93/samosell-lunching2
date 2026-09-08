"use client"

import { useState, useTransition } from "react"
import { setStoryMuteAction } from "@/app/stories/actions"

export default function StoryMuteButton({ userId, initialMuted }: { userId: string; initialMuted: boolean }) {
  const [muted, setMuted] = useState(initialMuted); const [pending, startTransition] = useTransition()
  return <button type="button" disabled={pending} aria-pressed={muted} onClick={() => startTransition(async () => { const result = await setStoryMuteAction(userId, !muted); if (result.ok) setMuted(!muted) })} className="ui-btn-secondary min-h-10">{muted ? "Stories-ის ჩართვა" : "Stories-ის დადუმება"}</button>
}
