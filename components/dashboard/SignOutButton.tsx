"use client"

import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

export default function SignOutButton() {
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <button
      onClick={handleSignOut}
      className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 hover:bg-neutral-100"
    >
      გასვლა
    </button>
  )
}
