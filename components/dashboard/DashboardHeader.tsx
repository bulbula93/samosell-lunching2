import Link from "next/link"
import SignOutButton from "@/components/dashboard/SignOutButton"
import { SITE_NAME } from "@/lib/site"

export default function DashboardHeader({
  email,
  isAdmin = false,
  unreadMessages = 0,
  favoriteCount = 0,
}: {
  email?: string
  isAdmin?: boolean
  unreadMessages?: number
  favoriteCount?: number
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-start justify-between gap-4">
          <Link
            href="/"
            aria-label="მთავარ გვერდზე დაბრუნება"
            className="group block rounded-2xl pr-3 transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-neutral-300"
          >
            <div className="text-xl font-black tracking-tight text-neutral-900 sm:text-2xl">{SITE_NAME}</div>
            <div className="text-sm text-neutral-500">{email ? `ანგარიში · ${email}` : "პირადი კაბინეტი"}</div>
          </Link>

          <div className="hidden items-center gap-2 sm:gap-3 md:flex">
            <Link href="/dashboard/chats" className="rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700">
              შეტყობინებები{unreadMessages > 0 ? ` · ${unreadMessages}` : ""}
            </Link>
            <Link href="/dashboard/listings/new" className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
              ახალი განცხადება
            </Link>
            <SignOutButton />
          </div>

          <div className="flex items-center gap-2 md:hidden">
            <Link href="/dashboard/listings/new" className="rounded-full bg-black px-4 py-2 text-sm font-semibold text-white">
              ახალი
            </Link>
            <details className="group relative">
              <summary className="list-none rounded-full border border-neutral-300 px-4 py-2 text-sm font-semibold text-neutral-700 marker:hidden">
                მენიუ
              </summary>
              <div className="absolute right-0 top-[calc(100%+0.6rem)] w-[19rem] overflow-hidden rounded-[1.5rem] border border-neutral-200 bg-white p-3 shadow-xl">
                <div className="mb-3 px-1">
                  <div className="text-sm font-black text-neutral-900">კაბინეტის მენიუ</div>
                  <div className="mt-1 text-xs leading-5 text-neutral-500">ყველა მთავარი მოქმედება ერთ ადგილას.</div>
                </div>

                <div className="grid gap-2">
                  <Link href="/dashboard" className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">კაბინეტი</Link>
                  <Link href="/dashboard/profile" className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">პროფილი</Link>
                  <Link href="/dashboard/listings" className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">ჩემი განცხადებები</Link>
                  <Link href="/dashboard/favorites" className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                    ფავორიტები{favoriteCount > 0 ? ` · ${favoriteCount}` : ""}
                  </Link>
                  <Link href="/dashboard/chats" className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">
                    შეტყობინებები{unreadMessages > 0 ? ` · ${unreadMessages}` : ""}
                  </Link>
                  <Link href="/dashboard/reports" className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">რეპორტები</Link>
                  <Link href="/dashboard/billing" className="rounded-2xl border border-neutral-200 px-4 py-3 text-sm font-semibold text-neutral-800 hover:bg-neutral-50">VIP განთავსება</Link>
                  {isAdmin ? (
                    <Link href="/admin" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                      ადმინისტრირება
                    </Link>
                  ) : null}
                  <div className="pt-2">
                    <SignOutButton />
                  </div>
                </div>
              </div>
            </details>
          </div>
        </div>

        <nav className="hidden gap-2 overflow-x-auto pb-1 text-sm font-medium text-neutral-700 md:flex">
          <Link href="/dashboard" className="whitespace-nowrap rounded-full border border-transparent px-3 py-2 hover:border-neutral-200 hover:bg-neutral-50">კაბინეტი</Link>
          <Link href="/dashboard/profile" className="whitespace-nowrap rounded-full border border-transparent px-3 py-2 hover:border-neutral-200 hover:bg-neutral-50">პროფილი</Link>
          <Link href="/dashboard/favorites" className="whitespace-nowrap rounded-full border border-transparent px-3 py-2 hover:border-neutral-200 hover:bg-neutral-50">ფავორიტები{favoriteCount > 0 ? ` · ${favoriteCount}` : ""}</Link>
          <Link href="/dashboard/reports" className="whitespace-nowrap rounded-full border border-transparent px-3 py-2 hover:border-neutral-200 hover:bg-neutral-50">რეპორტები</Link>
          <Link href="/dashboard/listings" className="whitespace-nowrap rounded-full border border-transparent px-3 py-2 hover:border-neutral-200 hover:bg-neutral-50">ჩემი განცხადებები</Link>
          <Link href="/dashboard/billing" className="whitespace-nowrap rounded-full border border-transparent px-3 py-2 hover:border-neutral-200 hover:bg-neutral-50">VIP განთავსება</Link>
          <Link href="/dashboard/chats" className="whitespace-nowrap rounded-full border border-transparent px-3 py-2 hover:border-neutral-200 hover:bg-neutral-50">ჩათები{unreadMessages > 0 ? ` · ${unreadMessages}` : ""}</Link>
          {isAdmin ? (
            <Link href="/admin" className="whitespace-nowrap rounded-full border border-amber-300 px-4 py-2 text-amber-900">
              ადმინისტრირება
            </Link>
          ) : null}
        </nav>

        <div className="flex gap-2 overflow-x-auto pb-1 md:hidden">
          <Link href="/dashboard" className="whitespace-nowrap rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700">კაბინეტი</Link>
          <Link href="/dashboard/listings" className="whitespace-nowrap rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700">განცხადებები</Link>
          <Link href="/dashboard/favorites" className="whitespace-nowrap rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700">ფავორიტები{favoriteCount > 0 ? ` · ${favoriteCount}` : ""}</Link>
          <Link href="/dashboard/chats" className="whitespace-nowrap rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700">ჩათები{unreadMessages > 0 ? ` · ${unreadMessages}` : ""}</Link>
          <Link href="/dashboard/billing" className="whitespace-nowrap rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm font-semibold text-neutral-700">VIP განთავსება</Link>
          {isAdmin ? <Link href="/admin" className="whitespace-nowrap rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">ადმინისტრირება</Link> : null}
        </div>
      </div>
    </header>
  )
}
