import Link from "next/link"
import { topCategories, type MegaMenuItem, type TopCategoryMenu } from "@/lib/home-page"

function UserIcon({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20C5.71265 17.6556 7.91119 16 10.5 16H13.5C16.0888 16 18.2873 17.6556 19 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function MegaMenuItemLink({ item, gender }: { item: MegaMenuItem; gender: TopCategoryMenu["gender"] }) {
  return (
    <Link
      href={{ pathname: "/catalog", query: { gender, q: item.label } }}
      className={`flex items-center justify-between gap-4 rounded-[14px] px-5 py-4 transition duration-150 hover:bg-[#E7E7E7] ${item.featured ? "bg-[#E7E7E7]" : "bg-transparent"}`}
    >
      <span className="text-[18px] font-semibold leading-7 text-[#202020]">{item.label}</span>
      <span className="shrink-0 text-[15px] leading-6 text-[#4A4A4A]">{item.count}</span>
    </Link>
  )
}

function HoverCategoryTab({ item }: { item: TopCategoryMenu }) {
  return (
    <div className={`group relative hidden shrink-0 lg:block ${item.widthClass}`}>
      <Link
        href={{ pathname: "/catalog", query: { gender: item.gender } }}
        className="relative flex h-16 items-center justify-center border-r border-black px-10 text-[16px] font-medium leading-6 text-[#2D2D2D] transition duration-200 hover:bg-[#D8D8D8] group-hover:bg-[#D0D0D0]"
      >
        <span>{item.label}</span>
        <span className="pointer-events-none absolute inset-x-0 bottom-[-1px] h-px bg-transparent group-hover:bg-[#D0D0D0]" />
      </Link>

      <div
        className={`pointer-events-none invisible absolute top-full z-50 w-[1440px] origin-top translate-y-3 scale-[0.98] opacity-0 transition duration-200 ease-out group-hover:pointer-events-auto group-hover:visible group-hover:translate-y-0 group-hover:scale-100 group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:scale-100 group-focus-within:opacity-100 ${item.dropdownOffsetClass}`}
      >
        <div className="absolute inset-x-0 top-[-18px] h-6" />
        <div className="rounded-[16px] border border-[#1B1B1B] bg-[#F3F3F3] px-[30px] pb-[28px] pt-[30px] shadow-[0_20px_45px_rgba(27,27,27,0.14)]">
          <div className="grid grid-cols-4 divide-x divide-[#D2D2D2]">
            {item.columns.map((column, columnIndex) => (
              <div key={`${item.gender}-${columnIndex}`} className="space-y-4 px-5 first:pl-0 last:pr-0">
                {column.map((entry) => (
                  <MegaMenuItemLink key={`${item.gender}-${entry.label}`} item={entry} gender={item.gender} />
                ))}
              </div>
            ))}
          </div>

          <div className="mt-5">
            <Link
              href={{ pathname: "/catalog", query: { gender: item.gender } }}
              className="inline-flex h-[56px] items-center justify-center rounded-[14px] border border-[#1B1B1B] bg-[#F88A51] px-6 text-[16px] font-semibold leading-6 text-white transition hover:bg-[#ef7b3f]"
            >
              ნახე ყველა ნივთი
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function HomeHeader({ signedIn, profileLabel }: { signedIn: boolean; profileLabel: string }) {
  return (
    <header className="bg-[#ECECEC]">
      <div className="mx-auto flex h-[42px] max-w-[1440px] items-center justify-between px-6 lg:px-8">
        <Link href="/" className="font-logo text-[32px] font-extrabold uppercase leading-10 tracking-[-0.04em] text-[#F88A51]">
          Samosell
        </Link>

        <Link
          href={signedIn ? "/dashboard/profile" : "/login"}
          className="inline-flex h-8 items-center justify-center gap-1 rounded-2xl border border-black bg-[#F88A51] px-3 text-[13px] leading-8 text-white transition hover:bg-[#ef7b3f] sm:h-12 sm:px-4 sm:text-[16px]"
        >
          <UserIcon className="hidden h-6 w-6 sm:block" />
          <span className="max-w-[110px] truncate">{signedIn ? profileLabel : "შესვლა"}</span>
        </Link>
      </div>

      <div className="border-y border-black/15 bg-[#E4E4E4]">
        <div className="mx-auto flex min-h-[64px] max-w-[1440px] items-stretch overflow-visible px-0 lg:relative lg:px-0">
          <div className="flex w-full items-stretch lg:hidden">
            {topCategories.map((item) => (
              <Link
                key={item.gender}
                href={{ pathname: "/catalog", query: { gender: item.gender } }}
                className="inline-flex flex-1 items-center justify-center border-r border-black/20 px-3 py-2 text-center text-[13px] font-medium leading-5 text-[#2D2D2D] transition hover:bg-white/40"
              >
                {item.label}
              </Link>
            ))}
          </div>

          <div className="hidden items-stretch lg:flex">
            {topCategories.map((item) => (
              <HoverCategoryTab key={item.gender} item={item} />
            ))}
          </div>
        </div>
      </div>
    </header>
  )
}
