import Link from "next/link"
import { ADVERTISE_WITH_US_HREF, type AdPlacementKey } from "@/lib/ads"

export default function AdPlaceholder({ placementKey }: { placementKey: AdPlacementKey }) {
  return (
    <article
      data-placement-key={placementKey}
      className="relative min-h-[13rem] overflow-hidden rounded-[1.75rem] border border-[#dfd6c2] bg-[#fffaf3] shadow-[0_12px_34px_rgba(31,74,67,0.07)]"
    >
      <div aria-hidden="true" className="absolute inset-y-0 right-0 w-[58%] sm:w-[55%]">
        <img
          src="/brand/samosell-ad-bg.jpg"
          alt=""
          className="h-full w-full object-contain object-right"
        />
      </div>

      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,250,243,1)_0%,rgba(255,250,243,0.98)_42%,rgba(255,250,243,0.82)_58%,rgba(255,250,243,0.18)_78%,rgba(255,250,243,0)_100%)]"
      />

      <div className="relative z-10 flex min-h-[13rem] max-w-[70%] flex-col justify-center p-5 sm:max-w-[64%] sm:p-6">
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
