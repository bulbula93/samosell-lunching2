import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"
import type { HomePageCollection } from "@/lib/home-page"
import type { CatalogListing } from "@/types/marketplace"

function SectionArrow({ direction }: { direction: "left" | "right" }) {
  return (
    <button
      suppressHydrationWarning
      type="button"
      aria-label={direction === "left" ? "წინა" : "შემდეგი"}
      className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#D9D9D9] bg-white text-[#F88A51] transition hover:-translate-y-0.5 hover:shadow-sm"
    >
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={`h-3.5 w-3.5 ${direction === "right" ? "rotate-180" : ""}`}>
        <path d="M14.5 6L8.5 12L14.5 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}

function CollectionCard({ item, title, href }: { item: CatalogListing | null; title: string; href: string }) {
  return (
    <Link href={href} className="group block">
      <div className="relative h-[124px] overflow-hidden rounded-[8px] bg-white shadow-[0_1px_1px_rgba(0,0,0,0.04)] sm:h-[154px] lg:h-[161px]">
        <SmartImage
          src={item?.cover_image_url}
          alt={title}
          wrapperClassName="absolute inset-0 h-full w-full"
          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.03]"
          fallbackLabel={title}
        />
      </div>
      <div className="mt-3 text-[18px] font-medium leading-6 text-[#2D2D2D]">{title}</div>
    </Link>
  )
}

export default function HomeCollectionsSection({ collections }: { collections: HomePageCollection[] }) {
  return (
    <section className="bg-[#ECECEC] px-4 py-10 sm:px-6 lg:px-10 lg:py-12">
      <div className="mx-auto max-w-[1440px]">
        <div className="mb-6 flex items-start justify-between gap-6">
          <h2 className="text-[28px] font-bold leading-8 text-[#2D2D2D]">კოლექციები</h2>
          <div className="hidden items-center gap-3 sm:flex">
            <SectionArrow direction="left" />
            <SectionArrow direction="right" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-7 md:grid-cols-3">
          {collections.map((collection) => (
            <CollectionCard key={collection.title} item={collection.item} title={collection.title} href={collection.href} />
          ))}
        </div>
      </div>
    </section>
  )
}
