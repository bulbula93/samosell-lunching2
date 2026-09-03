import SmartImage from "@/components/shared/SmartImage"
import AdImpressionTracker from "@/components/ads/AdImpressionTracker"
import {
  ADVERTISE_WITH_US_HREF,
  getAdClickHref,
  getSafeAdImage,
  isExternalAdTarget,
  normalizeAdTargetUrl,
  type AdRecord,
} from "@/lib/ads"

export default function AdBanner({ ad, pagePath }: { ad: AdRecord; pagePath: string }) {
  const image = getSafeAdImage(ad.image_url)
  const target = normalizeAdTargetUrl(ad.target_url)
  const external = isExternalAdTarget(target)
  const href = target ? getAdClickHref(ad, pagePath) : ADVERTISE_WITH_US_HREF
  const title = ad.title || ad.advertiser_name || "სპეციალური შეთავაზება"
  const description = ad.description || "აღმოაჩინე SamoSell-ის პარტნიორის შეთავაზება"

  return (
    <article className="relative grid min-h-[13rem] overflow-hidden rounded-[1.75rem] border border-[#dfd6c2] bg-[#faf5e9] shadow-[0_12px_34px_rgba(31,74,67,0.07)] sm:grid-cols-[minmax(0,1fr)_10rem]">
      <AdImpressionTracker adId={ad.id} placementKey={ad.placement_key} pagePath={pagePath} />
      <div className="relative z-10 flex min-w-0 flex-col justify-center p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-fit rounded-full border border-brand/15 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-brand">
            რეკლამა
          </span>
          {ad.advertiser_name ? (
            <span className="truncate text-xs font-semibold text-text-soft">{ad.advertiser_name}</span>
          ) : null}
        </div>
        <h2 className="mt-3 text-xl font-black leading-tight tracking-[-0.025em] text-brand sm:text-2xl">
          {title}
        </h2>
        <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-soft">{description}</p>
        <a
          href={href}
          target={external ? "_blank" : undefined}
          rel="sponsored noopener noreferrer"
          className="mt-4 inline-flex min-h-11 w-fit items-center justify-center rounded-xl bg-brand px-5 text-sm font-black text-white transition hover:bg-[#064c47] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          შეთავაზების ნახვა
        </a>
      </div>

      {image ? (
        <SmartImage
          src={image}
          alt={title}
          wrapperClassName="h-40 w-full border-t border-[#dfd6c2] sm:h-full sm:border-l sm:border-t-0"
          className="object-cover"
          fallbackLabel=""
          loading="lazy"
          sizes="(max-width: 640px) 100vw, 160px"
        />
      ) : (
        <div aria-hidden="true" className="relative hidden overflow-hidden border-l border-[#dfd6c2] bg-[radial-gradient(circle_at_30%_30%,rgba(158,227,218,0.9),transparent_36%),linear-gradient(145deg,#e8f4ef,#f4e7c7)] sm:block">
          <div className="absolute -right-8 top-4 h-24 w-24 rounded-full border border-brand/15" />
          <div className="absolute bottom-5 left-5 h-12 w-12 rounded-2xl bg-brand/90" />
        </div>
      )}
    </article>
  )
}
