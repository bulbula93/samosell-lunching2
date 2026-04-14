import SmartImage from "@/components/shared/SmartImage"
import type { HomeHeroImages } from "@/lib/home-page"
import type { CatalogListing } from "@/types/marketplace"

function SearchIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M10.5 17C14.0899 17 17 14.0899 17 10.5C17 6.91015 14.0899 4 10.5 4C6.91015 4 4 6.91015 4 10.5C4 14.0899 6.91015 17 10.5 17Z" stroke="currentColor" strokeWidth="1.8" />
      <path d="M15.5 15.5L20 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function FloatingHeroCard({ item, className, alt }: { item: CatalogListing | null | undefined; className: string; alt: string }) {
  return (
    <div className={`absolute overflow-hidden border-4 border-white bg-white shadow-[0_14px_30px_rgba(45,45,45,0.12)] ${className}`}>
      <SmartImage
        src={item?.cover_image_url}
        alt={alt}
        wrapperClassName="h-full w-full"
        className="h-full w-full object-cover"
        fallbackLabel="ახალი ნივთი"
        loading="eager"
      />
    </div>
  )
}

export default function HomeSearchHeroSection({ heroImages }: { heroImages: HomeHeroImages }) {
  return (
    <section className="relative overflow-hidden bg-[linear-gradient(90deg,#EBA173_0%,#DABA73_100%)]">
      <div className="mx-auto relative min-h-[231px] max-w-[1440px] px-4 py-8 sm:px-6 lg:px-10 lg:py-0">
        <div className="hidden lg:block">
          <FloatingHeroCard item={heroImages.left} alt="მარცხენა ნივთი" className="left-[32px] top-[57px] h-[118px] w-[91px] -rotate-[28.82deg] rounded-[25px]" />
          <FloatingHeroCard item={heroImages.right} alt="მარჯვენა ნივთი" className="right-[153px] top-[14px] h-[154px] w-[116px] rotate-[11.8deg] rounded-[38px]" />
          <FloatingHeroCard item={heroImages.rightSmall} alt="მარჯვენა პატარა ნივთი" className="right-[30px] top-[110px] h-[103px] w-[77px] rotate-[17.73deg] rounded-[24px]" />
        </div>

        <div className="mx-auto max-w-[950px] lg:pt-[26px]">
          <div className="relative ml-[110px] inline-flex h-10 items-center rounded-full bg-white px-5 text-[16px] font-medium leading-6 text-[#2D2D2D] shadow-[0_4px_12px_rgba(0,0,0,0.05)] max-lg:ml-0">
            რას ეძებ?
            <span className="absolute -left-3.5 bottom-[-11px] h-3 w-3 rounded-full border-4 border-[#EBA173] bg-white" />
          </div>

          <form action="/catalog" className="relative mt-4 flex h-[48px] items-center rounded-full border border-black/30 bg-[#ECECEC] pl-6 pr-[118px] shadow-[0_4px_12px_rgba(0,0,0,0.06)] lg:mx-auto lg:max-w-[822px]">
            <input
              type="text"
              name="q"
              defaultValue='მოძებნე "ვინტაჟ მარგელო"'
              className="h-full w-full bg-transparent text-[16px] font-medium leading-6 text-[#444] outline-none placeholder:text-[#444]"
            />
            <div className="absolute right-[108px] top-1/2 h-6 w-px -translate-y-1/2 bg-black/15" />
            <button
              type="submit"
              className="absolute right-[6px] top-1/2 inline-flex h-[38px] w-[96px] -translate-y-1/2 items-center justify-center gap-2 rounded-full border border-[#99562A] bg-[#F88A51] text-[14px] font-medium leading-6 text-white shadow-[0_4px_12px_rgba(248,138,81,0.3)] transition hover:bg-[#ef7b3f]"
            >
              <SearchIcon className="h-4 w-4" />
              ძებნა
            </button>
          </form>
        </div>
      </div>
    </section>
  )
}
