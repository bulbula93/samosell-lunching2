import SmartImage from "@/components/shared/SmartImage"
import type { CatalogListing } from "@/types/marketplace"

function BannerTile({ item, alt, className, fallbackLabel }: { item?: CatalogListing | null; alt: string; className: string; fallbackLabel: string }) {
  return (
    <div className={className}>
      <SmartImage src={item?.cover_image_url} alt={alt} wrapperClassName="h-full w-full" className="h-full w-full object-cover" fallbackLabel={fallbackLabel} />
    </div>
  )
}

export default function HomePromoBanner({ bannerItems }: { bannerItems: CatalogListing[] }) {
  return (
    <section className="bg-[#ECECEC] px-0 pb-10">
      <div className="relative mx-auto h-[238px] max-w-[1440px] overflow-hidden bg-[linear-gradient(90deg,#5D412E_0%,#1F2935_100%)]">
        {bannerItems[0]?.cover_image_url ? (
          <div className="absolute inset-0 opacity-35 blur-[10px]">
            <SmartImage
              src={bannerItems[0].cover_image_url}
              alt="ბანერი"
              wrapperClassName="h-full w-full"
              className="h-full w-full object-cover"
              fallbackLabel="ბანერი"
            />
          </div>
        ) : null}

        <div className="absolute inset-0 bg-[linear-gradient(0deg,rgba(0,0,0,0.35),rgba(0,0,0,0.1))]" />
        <div className="absolute bottom-0 left-0 right-0 h-[58px] bg-black/28 backdrop-blur-[2px]" />

        <BannerTile item={bannerItems[0]} alt="ბანერი 1" fallbackLabel="1" className="absolute left-[12%] top-[72px] h-[88px] w-[110px] overflow-hidden rounded-[6px] shadow-[0_22px_30px_rgba(0,0,0,0.28)]" />
        <BannerTile item={bannerItems[1]} alt="ბანერი 2" fallbackLabel="2" className="absolute left-[30%] top-[8px] h-[84px] w-[125px] overflow-hidden rounded-[18px] shadow-[0_22px_30px_rgba(0,0,0,0.24)]" />
        <BannerTile item={bannerItems[2]} alt="ბანერი 3" fallbackLabel="3" className="absolute left-[28%] top-[98px] h-[86px] w-[124px] overflow-hidden rounded-[16px] shadow-[0_22px_30px_rgba(0,0,0,0.24)]" />
        <BannerTile item={bannerItems[3]} alt="ბანერი 4" fallbackLabel="4" className="absolute right-[14%] top-[103px] h-[66px] w-[124px] overflow-hidden rounded-[16px] shadow-[0_22px_30px_rgba(0,0,0,0.24)]" />

        <div className="absolute bottom-8 left-10 text-white">
          <div className="text-[16px] font-medium leading-6">ბანერის სათაური</div>
          <div className="mt-0.5 text-[10px] leading-4 text-white/90">კომპექტეს აღწერის მცირე დატეილები</div>
        </div>

        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-2">
          <span className="h-2 w-5 rounded-full bg-[#F88A51]" />
          <span className="h-2 w-5 rounded-full bg-white/90" />
          <span className="h-2 w-5 rounded-full bg-white/90" />
          <span className="h-2 w-5 rounded-full bg-white/90" />
        </div>
      </div>
    </section>
  )
}
