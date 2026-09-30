import Link from "next/link"
import { ADVERTISE_WITH_US_HREF, type AdPlacementKey } from "@/lib/ads"

export default function AdPlaceholder({ placementKey }: { placementKey: AdPlacementKey }) {
  return (
    <article
      data-placement-key={placementKey}
      className="relative flex min-h-[13rem] overflow-hidden rounded-[1.75rem] border border-[#dfd6c2] bg-[#f7eadc] bg-cover bg-center bg-no-repeat p-5 shadow-[0_12px_34px_rgba(31,74,67,0.07)] sm:p-6"
      style={{ backgroundImage: "url('https://lh7-us.googleusercontent.com/docsdf/AFQj2d7l9ZcdIfDlgsPXlieRHHQTMhbMqJPoUY9Pn_UJWrHeBQrIkx3TsuC1gm-y0B7NRNebXqtYyAbTKZ8JrmSLBttMXj5YYX6cZB8Z0PI-_Sjc2wLWESejLyWitkg-ANcoMFtEL9oLH-2Th7CEItd4IBBSWGIeCa0RiFh2XILuDxGclezJ=s1600')" }}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,252,247,0.97)_0%,rgba(255,252,247,0.86)_38%,rgba(255,252,247,0.18)_64%,rgba(255,252,247,0)_100%)]" />
      <div className="relative z-10 flex max-w-md flex-col justify-center">
        <span className="w-fit rounded-full border border-brand/15 bg-white/80 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-brand">
          რეკლამა
        </span>
        <h2 className="mt-3 text-xl font-black leading-tight tracking-[-0.025em] text-brand sm:text-2xl">
          განათავსე რეკლამა ჩვენს გვერდზე
        </h2>
        <p className="mt-2 text-sm leading-6 text-text-soft">
          შექმენი რეკლამა თვითონ და მიაბი შენი მაღაზია ან სოციალური გვერდი
        </p>
        <Link href={ADVERTISE_WITH_US_HREF} className="mt-4 inline-flex min-h-11 w-fit items-center justify-center rounded-xl border border-brand/20 bg-white px-5 text-sm font-black text-brand transition hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
          რეკლამის შექმნა
        </Link>
      </div>

    </article>
  )
}
