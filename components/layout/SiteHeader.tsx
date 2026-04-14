import Link from "next/link"
import Avatar from "@/components/shared/Avatar"
import { createClient } from "@/lib/supabase/server"
import { getUserAvatar } from "@/lib/profiles"

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5v-9Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-6 w-6">
      <path d="M12 20.4s-7-4.2-7-10a4.2 4.2 0 0 1 7-3.1A4.2 4.2 0 0 1 19 10.4c0 5.8-7 10-7 10Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="h-5 w-5 text-[#3C4043]">
      <path d="m7 10 5 5 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function HeaderWordmark() {
  return <span className="font-logo text-[32px] font-bold leading-10 tracking-[-0.03em] text-[#1B1B1B]">Samosell</span>
}

export default async function SiteHeader() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const profileResponse = user
    ? await supabase
        .from("profiles")
        .select("is_admin, avatar_url, full_name, username, store_logo_url")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null as { is_admin?: boolean; avatar_url?: string | null; full_name?: string | null; username?: string | null; store_logo_url?: string | null } | null }

  const profile = profileResponse.data
  const profileLabel = profile?.full_name || profile?.username || "პროფილი"

  return (
    <header className="sticky top-0 z-40 border-b border-[#2D2D2D] bg-white">
      <div className="mx-auto flex min-h-20 w-full max-w-[1441px] items-center justify-between gap-4 px-4 py-2 sm:px-6 lg:px-8 xl:px-6">
        <Link href="/" aria-label="მთავარ გვერდზე დაბრუნება" className="inline-flex items-center transition hover:opacity-90">
          <HeaderWordmark />
        </Link>

        {user ? (
          <div className="flex items-center gap-3 sm:gap-6">
            {profile?.is_admin ? (
              <Link href="/admin" className="hidden rounded-[8px] border border-[#1B1B1B] px-4 py-3 text-[16px] font-semibold text-[#2D2D2D] lg:inline-flex">
                ადმინი
              </Link>
            ) : null}

            <Link href="/dashboard/listings/new" className="inline-flex h-14 items-center justify-center rounded-[8px] bg-[#2D2D2D] px-4 text-[14px] font-semibold text-white transition hover:bg-[#1F1F1F] sm:px-6 sm:text-[16px]">
              ახალი განცხადება
            </Link>

            <div className="hidden items-center gap-6 sm:flex">
              <Link href="/dashboard/chats" className="text-[#2E3134] transition hover:text-[#F88A51]" aria-label="შეტყობინებები">
                <MailIcon />
              </Link>
              <Link href="/dashboard/favorites" className="text-[#2E3134] transition hover:text-[#F88A51]" aria-label="ფავორიტები">
                <HeartIcon />
              </Link>
            </div>

            <Link href="/dashboard/profile" className="inline-flex items-center gap-2">
              <Avatar
                src={getUserAvatar(profile)}
                alt={profileLabel}
                fallbackText={profileLabel}
                sizeClassName="h-14 w-14"
                textClassName="text-sm"
                className="border-0 shadow-none ring-0"
              />
              <ChevronDownIcon />
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-3 sm:gap-6">
            <Link href="/login" className="inline-flex h-14 items-center justify-center rounded-[8px] bg-[#2D2D2D] px-5 text-[16px] font-semibold text-white transition hover:bg-[#1F1F1F]">
              შესვლა
            </Link>
          </div>
        )}
      </div>
    </header>
  )
}
