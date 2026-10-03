import Image from "next/image"
import Link from "next/link"
import { ADVERTISE_WITH_US_HREF, type AdPlacementKey } from "@/lib/ads"

export default function AdPlaceholder({ placementKey }: { placementKey: AdPlacementKey }) {
  return (
    <article
      data-placement-key={placementKey}
      className="relative min-h-[13rem] overflow-hidden rounded-[1.75rem] border border-[#dfd6c2] bg-[#f7eadc] shadow-[0_12px_34px_rgba(31,74,67,0.07)]"
    >
      <Image
        src="/brand/samosell-ad-bg.jpg"
        alt=""
        aria-hidden="true"
        fill
        sizes="(max-width: 767px) 100vw, (max-width: 1279px) 50vw, 640px"
        loading={placementKey.startsWith("catalog_top") ? "eager" : "lazy"}
        fetchPriority={placementKey.startsWith("catalog_top") ? "high" : "auto"}
        className="absolute inset-0 h-full w-full object-cover object-[62%_center]"
      />

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,250,243,0.99)_0%,rgba(255,250,243,0.96)_34%,rgba(255,250,243,0.78)_50%,rgba(255,250,243,0.28)_69%,rgba(255,250,243,0.06)_100%)]"
      />

      <div className="relative z-10 flex min-h-[13rem] max-w-[72%] flex-col justify-center p-5 sm:max-w-[62%] sm:p-6">
        <span className="w-fit rounded-full border border-brand/15 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand shadow-sm">
          რეკლამა
        </span>

        <h2 className="mt-3 text-xl font-black leading-tight tracking-[-0.025em] text-brand sm:text-2xl">
          განათავსე რეკლამა ჩვენს გვერდზე
        </h2>

        <p className="mt-2 max-w-sm text-sm leading-6 text-[#52635f]">
          შექმენი რეკლამა თვითონ და მიაბი შენი მაღაზია ან სოციალური გვერდი
        </p>

        <Link
          href={ADVERTISE_WITH_US_HREF}
          className="mt-4 inline-flex min-h-11 w-fit items-center justify-center rounded-xl border border-brand/20 bg-white/95 px-5 text-sm font-semibold text-brand shadow-sm transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          რეკლამის შექმნა
        </Link>
      </div>
    </article>
  )
}
