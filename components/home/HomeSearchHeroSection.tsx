import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"
import { ka } from "@/lib/i18n/ka"
import type { CatalogListing } from "@/types/marketplace"

export default function HomeSearchHeroSection({ items }: { items: CatalogListing[] }) {
  const [primary, secondary, tertiary] = items

  return (
    <section className="overflow-hidden border-b border-line bg-[radial-gradient(circle_at_85%_15%,rgba(40,170,153,0.22),transparent_32%),linear-gradient(135deg,#eff8f6_0%,#f9fbfa_54%,#e5f1ee_100%)]">
      <div className="ui-container grid min-h-[500px] items-center gap-10 py-12 md:grid-cols-[1.08fr_0.92fr] md:py-16 lg:min-h-[570px]">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">{ka.home.eyebrow}</p>
          <h1 className="mt-5 text-[clamp(2.45rem,6vw,5rem)] font-black leading-[1.02] tracking-[-0.045em] text-text">
            {ka.home.title}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-text-soft sm:text-lg">
            {ka.home.description}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/catalog" className="ui-btn-primary min-h-12 px-7 text-base">
              {ka.home.startShopping}
            </Link>
            <Link href="/dashboard/listings/new" className="ui-btn-secondary min-h-12 px-7 text-base">
              {ka.home.startSelling}
            </Link>
          </div>
          <p className="mt-6 text-sm font-semibold text-text-soft">
            რეალური განცხადებები · პირდაპირი კავშირი გამყიდველთან
          </p>
        </div>

        <div className="relative mx-auto h-[340px] w-full max-w-[520px] sm:h-[420px]" aria-label="SAMOSELL-ის განცხადებების კოლაჟი">
          <div className="absolute left-[8%] top-[6%] h-[72%] w-[58%] rotate-[-4deg] overflow-hidden rounded-[28px] border-8 border-white bg-surface shadow-[0_28px_80px_rgba(7,63,59,0.18)]">
            <SmartImage
              src={primary?.cover_image_url}
              alt={primary?.title || "SAMOSELL-ის განცხადება"}
              wrapperClassName="h-full w-full"
              className="h-full w-full object-cover"
              fallbackLabel="აქ გამოჩნდება ახალი ნივთი"
              loading="eager"
              sizes="(max-width: 768px) 60vw, 360px"
            />
          </div>
          <div className="absolute right-[3%] top-[11%] h-[47%] w-[38%] rotate-[7deg] overflow-hidden rounded-[22px] border-[6px] border-white bg-surface shadow-[0_22px_55px_rgba(7,63,59,0.14)]">
            <SmartImage
              src={secondary?.cover_image_url}
              alt={secondary?.title || "SAMOSELL-ის განცხადება"}
              wrapperClassName="h-full w-full"
              className="h-full w-full object-cover"
              fallbackLabel="ახალი ნივთი"
              loading="eager"
              sizes="(max-width: 768px) 38vw, 220px"
            />
          </div>
          <div className="absolute bottom-[2%] right-[12%] h-[42%] w-[38%] rotate-[3deg] overflow-hidden rounded-[22px] border-[6px] border-white bg-surface shadow-[0_22px_55px_rgba(7,63,59,0.14)]">
            <SmartImage
              src={tertiary?.cover_image_url}
              alt={tertiary?.title || "SAMOSELL-ის განცხადება"}
              wrapperClassName="h-full w-full"
              className="h-full w-full object-cover"
              fallbackLabel="გამორჩეული ნივთი"
              sizes="(max-width: 768px) 38vw, 220px"
            />
          </div>
          <div className="absolute bottom-[7%] left-0 rounded-2xl border border-brand/15 bg-white/95 px-4 py-3 shadow-[0_14px_34px_rgba(7,63,59,0.12)] backdrop-blur">
            <div className="text-xs font-bold text-brand">მეორე სიცოცხლე ნივთებს</div>
            <div className="mt-1 text-sm font-black text-text">საკუთარი სტილი შენს წესებზე</div>
          </div>
        </div>
      </div>
    </section>
  )
}
