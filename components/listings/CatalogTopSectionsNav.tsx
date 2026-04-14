import Link from "next/link"

const topSections = [
  { label: "მამაკაცებისთვის", value: "men" },
  { label: "ქალებისთვის", value: "women" },
  { label: "ბავშვებისთვის", value: "kids" },
] as const

export default function CatalogTopSectionsNav({ gender }: { gender?: string }) {
  return (
    <section className="border-b border-[#2D2D2D] bg-[#F3F3F3]">
      <div className="mx-auto flex w-full max-w-[1560px] overflow-x-auto px-0">
        {topSections.map((section) => {
          const href = section.value === gender ? "/catalog" : `/catalog?gender=${section.value}`
          const active = gender === section.value
          return (
            <Link
              key={section.value}
              href={href}
              className={`inline-flex h-12 shrink-0 items-center justify-center border-r border-[#2D2D2D] px-10 text-[16px] font-medium leading-6 transition md:h-14 ${active ? "bg-[#D9D9D9]" : "bg-[#F3F3F3] hover:bg-[#E6E6E6]"}`}
            >
              {section.label}
            </Link>
          )
        })}
      </div>
    </section>
  )
}
