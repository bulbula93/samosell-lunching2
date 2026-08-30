import Link from "next/link"
import SmartImage from "@/components/shared/SmartImage"
import { ka } from "@/lib/i18n/ka"
import { formatPrice } from "@/lib/listings"
import type { CatalogListing } from "@/types/marketplace"

function getVipCardLayout(itemCount: number, index: number) {
  if (itemCount === 1) return "col-span-2 row-span-2"
  if (itemCount === 2) return "row-span-2"
  return index === 0 ? "row-span-2" : ""
}

export default function HomeSearchHeroSection({ items }: { items: CatalogListing[] }) {
  const vipItems = items.filter((item) => item.is_vip).slice(0, 3)

  return (
    <section className="overflow-hidden border-b border-line bg-[radial-gradient(circle_at_85%_15%,rgba(40,170,153,0.22),transparent_32%),linear-gradient(135deg,#eff8f6_0%,#f9fbfa_54%,#e5f1ee_100%)]">
      <div className="ui-container grid min-h-[500px] items-center gap-10 py-12 md:grid-cols-[1.08fr_0.92fr] md:py-16 lg:min-h-[570px]">
        <div className="max-w-2xl">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-brand">{ka.home.eyebrow}</p>
          <h1 className="mt-5 max-w-[15ch] text-balance text-[clamp(2.35rem,5.5vw,4.7rem)] font-normal leading-[1.09] tracking-[-0.025em] text-text">
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

        <div className="relative mx-auto h-[340px] w-full max-w-[520px] sm:h-[420px]" aria-label="VIP განცხადებების სივრცე">
          {vipItems.length > 0 ? (
            <div className="grid h-full grid-cols-2 grid-rows-2 gap-3 rounded-[32px] border border-[#e8c778]/45 bg-[#062f2c] p-3 shadow-[0_28px_80px_rgba(7,63,59,0.2)]">
              {vipItems.map((item, index) => {
                const layoutClass = getVipCardLayout(vipItems.length, index)

                return (
                  <Link
                    key={item.id}
                    href={`/listing/${item.slug}`}
                    aria-label={`VIP განცხადება: ${item.title}`}
                    className={`group relative min-h-0 overflow-hidden rounded-[22px] border border-white/20 bg-brand ${layoutClass}`}
                  >
                    <SmartImage
                      src={item.cover_image_url}
                      alt={item.title}
                      wrapperClassName="h-full w-full"
                      className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.035]"
                      fallbackLabel="VIP განცხადება"
                      loading="eager"
                      sizes={index === 0 ? "(max-width: 768px) 90vw, 300px" : "(max-width: 768px) 45vw, 190px"}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_36%,rgba(3,28,26,0.9)_100%)]" />
                    <div className="absolute left-3 top-3 rounded-full border border-[#f6d98e]/60 bg-[#102f2b]/90 px-3 py-1 text-[10px] font-black tracking-[0.16em] text-[#f6d98e] shadow-sm backdrop-blur">
                      VIP
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <h2 className="line-clamp-2 text-sm font-black sm:text-base">{item.title}</h2>
                      <p className="mt-1 text-sm font-black text-[#f6d98e]">{formatPrice(item.price, item.currency)}</p>
                    </div>
                  </Link>
                )
              })}
            </div>
          ) : (
            <div className="relative flex h-full overflow-hidden rounded-[32px] border border-[#e8c778]/55 bg-[radial-gradient(circle_at_85%_15%,rgba(246,217,142,0.2),transparent_30%),linear-gradient(145deg,#073f3b_0%,#052c29_100%)] p-7 text-white shadow-[0_28px_80px_rgba(7,63,59,0.2)] sm:p-10">
              <div className="relative z-10 flex max-w-sm flex-col justify-end">
                <span className="w-fit rounded-full border border-[#f6d98e]/55 bg-white/5 px-4 py-2 text-xs font-black tracking-[0.18em] text-[#f6d98e]">
                  VIP სივრცე
                </span>
                <h2 className="mt-5 text-3xl font-black leading-tight tracking-[-0.035em] sm:text-4xl">
                  შენი ნივთი გამოაჩინე პირველივე ეკრანზე
                </h2>
                <p className="mt-4 text-sm leading-7 text-white/70">
                  აქ გამოჩნდება მხოლოდ აქტიური VIP განცხადებები
                </p>
                <Link
                  href="/dashboard/listings"
                  className="mt-7 inline-flex min-h-12 w-fit items-center justify-center rounded-xl bg-[#f6d98e] px-6 text-sm font-black text-[#073f3b] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  შექმენი VIP განცხადება
                </Link>
              </div>
              <div aria-hidden="true" className="absolute -right-12 -top-12 h-48 w-48 rounded-full border border-[#f6d98e]/20" />
              <div aria-hidden="true" className="absolute -right-3 top-16 h-32 w-32 rounded-full border border-[#f6d98e]/15" />
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
