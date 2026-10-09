"use client"

import { useState, useTransition } from "react"
import { setFollowAction } from "@/app/stories/actions"
import SellerActionIcon from "@/components/sellers/SellerActionIcon"

type FollowButtonProps = {
  userId: string
  initialFollowing: boolean
  variant?: "default" | "profile"
}

export default function FollowButton({ userId, initialFollowing, variant = "default" }: FollowButtonProps) {
  const [following, setFollowing] = useState(initialFollowing)
  const [error, setError] = useState("")
  const [pending, startTransition] = useTransition()

  const toggleFollow = () => startTransition(async () => {
    const result = await setFollowAction(userId, !following)
    if (result.ok) {
      setFollowing(result.followed)
      setError("")
    } else {
      setError(result.message)
    }
  })

  return (
    <div className={variant === "profile" ? "min-w-0" : ""}>
      <button
        type="button"
        disabled={pending}
        aria-pressed={following}
        onClick={toggleFollow}
        className={
          variant === "profile"
            ? following
              ? "flex min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-xl border border-[#c9dcd6] bg-white px-1.5 text-[11px] font-bold text-[#075a53] transition hover:bg-[#eff8f6] disabled:opacity-50 sm:gap-2 sm:px-3 sm:text-sm"
              : "flex min-h-11 w-full min-w-0 items-center justify-center gap-1 rounded-xl bg-[#075a53] px-1.5 text-[11px] font-bold text-white transition hover:bg-[#064a45] disabled:opacity-50 sm:gap-2 sm:px-3 sm:text-sm"
            : following ? "ui-btn-secondary min-h-10" : "ui-btn-primary min-h-10"
        }
      >
        {variant === "profile" ? (
          <>
            <SellerActionIcon name={following ? "following" : "follow"} />
            <span className="min-w-0 truncate">{following ? "მიჰყვები" : "გამოწერა"}</span>
          </>
        ) : (following ? "გამოწერილი ✓" : "გამოწერა")}
      </button>
      {error ? <p role="alert" className="mt-1 text-xs text-red-700">{error}</p> : null}
    </div>
  )
}
