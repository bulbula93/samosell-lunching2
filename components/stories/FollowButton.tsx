"use client"

import { useState, useTransition } from "react"
import { setFollowAction } from "@/app/stories/actions"

export default function FollowButton({ userId, initialFollowing }: { userId: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()
  return <div><button type="button" disabled={pending} aria-pressed={following} onClick={() => startTransition(async () => { const result = await setFollowAction(userId, !following); if (result.ok) { setFollowing(result.followed); setError("") } else setError(result.message) })} className={following ? "ui-btn-secondary min-h-10" : "ui-btn-primary min-h-10"}>{following ? "გამოწერილი ✓" : "გამოწერა"}</button>{error ? <p role="alert" className="mt-1 text-xs text-red-700">{error}</p> : null}</div>
}
