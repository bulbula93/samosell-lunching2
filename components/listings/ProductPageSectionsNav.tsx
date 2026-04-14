import Link from "next/link"

const items = [
  { label: "მამაკაცის ტანსაცმელი", href: "/catalog?gender=men" },
  { label: "ქალის ტანსაცმელი", href: "/catalog?gender=women" },
  { label: "ბავშვის ტანსაცმელი", href: "/catalog?gender=kids" },
]

export default function ProductPageSectionsNav() {
  return (
    <nav className="border-y border-[#1B1B1B] bg-white">
      <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center gap-1 px-4 py-2 sm:px-6 lg:px-8 xl:px-12">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="inline-flex min-h-12 items-center justify-center rounded-md px-3 py-3 text-[14px] font-medium text-[#2D2D2D] transition hover:bg-[#F6F6F6] sm:px-4 sm:text-[16px]"
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
