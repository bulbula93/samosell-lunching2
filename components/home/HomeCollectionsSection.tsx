"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { ka } from "@/lib/i18n/ka"
import type { PopularBrand } from "@/lib/home-page"

const SHOWCASE_BRANDS = [
  { name: "Zara", domain: "zara.com" },
  { name: "adidas", domain: "adidas.com" },
  { name: "Nike", domain: "nike.com" },
  { name: "Mango", domain: "mango.com" },
  { name: "H&M", domain: "hm.com" },
  { name: "Bershka", domain: "bershka.com" },
  { name: "Pull&Bear", domain: "pullandbear.com" },
  { name: "Stradivarius", domain: "stradivarius.com" },
  { name: "Massimo Dutti", domain: "massimodutti.com" },
  { name: "New Balance", domain: "newbalance.com" },
  { name: "Levi's", domain: "levi.com" },
  { name: "Puma", domain: "puma.com" },
  { name: "Reebok", domain: "reebok.com" },
  { name: "Uniqlo", domain: "uniqlo.com" },
  { name: "Vans", domain: "vans.com" },
  { name: "The North Face", domain: "thenorthface.com" },
  { name: "Lacoste", domain: "lacoste.com" },
  { name: "Calvin Klein", domain: "calvinklein.com" },
  { name: "Gucci", domain: "gucci.com" },
  { name: "Prada", domain: "prada.com" },
] as const

function normalizeBrand(value: string) {
  return value.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, "")
}

function BrandMark({ name, domain }: { name: string; domain: string }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#e8ece9] bg-white shadow-[0_3px_12px_rgba(7,63,59,0.06)]">
      {failed ? (
        <span className="text-sm font-black text-brand">{name.slice(0, 2)}</span>
      ) : (
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
          alt=""
          width={32}
          height={32}
          loading="lazy"
          className="h-8 w-8 object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}

export default function HomeCollectionsSection({ brands }: { brands: PopularBrand[] }) {
  const viewportRef = useRef<HTMLDivElement>(null)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [paused, setPaused] = useState(false)

  const activeCounts = useMemo(() => {
    const map = new Map<string, number>()
    for (const brand of brands) {
      map.set(normalizeBrand(brand.name), brand.count)
    }
    return map
  }, [brands])

  const carouselBrands = useMemo(
    () =>
      SHOWCASE_BRANDS.map((brand) => ({
        ...brand,
        count: activeCounts.get(normalizeBrand(brand.name)) ?? 0,
      })),
    [activeCounts]
  )

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || paused) return

    let frame = 0
    let previous = performance.now()

    const tick = (now: number) => {
      const delta = Math.min(now - previous, 40)
      previous = now

      if (!document.hidden) {
        viewport.scrollLeft += delta * 0.035

        const halfway = viewport.scrollWidth / 2
        if (halfway > 0 && viewport.scrollLeft >= halfway) {
          viewport.scrollLeft -= halfway
        }
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [paused])

  function pauseTemporarily() {
    setPaused(true)
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => setPaused(false), 2200)
  }

  function nudge(direction: "left" | "right") {
    const viewport = viewportRef.current
    if (!viewport) return
    setPaused(true)
    viewport.scrollBy({ left: direction === "right" ? 420 : -420, behavior: "smooth" })
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => setPaused(false), 1800)
  }

  useEffect(
    () => () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    },
    []
  )

  const loop = [...carouselBrands, ...carouselBrands]

  return (
    <section id="brands" className="relative overflow-hidden border-b border-line/70 bg-[#fffaf6] py-10 sm:py-14">
      <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-8 h-52 w-52 rounded-full bg-[#e8f6f1] blur-3xl" />
      <div aria-hidden="true" className="pointer-events-none absolute -right-24 bottom-0 h-56 w-56 rounded-full bg-[#fff0dc] blur-3xl" />

      <div className="ui-container relative">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand/10 bg-white px-3 py-1.5 text-xs font-black uppercase tracking-[0.14em] text-brand shadow-sm">
              <span className="h-2 w-2 rounded-full bg-accent" />
              ბრენდების არჩევანი
            </div>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.045em] text-brand sm:text-4xl">
              {ka.home.brands}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-text-soft sm:text-base">
              დაათვალიერე პოპულარული ბრენდები — კარუსელი ავტომატურად მოძრაობს, ხოლო სურვილის შემთხვევაში შეგიძლია გადაასრიალო.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              aria-label="წინა ბრენდები"
              onClick={() => nudge("left")}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-brand/10 bg-white text-lg font-black text-brand shadow-sm transition hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-md"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="შემდეგი ბრენდები"
              onClick={() => nudge("right")}
              className="flex h-11 w-11 items-center justify-center rounded-2xl border border-brand/10 bg-white text-lg font-black text-brand shadow-sm transition hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-md"
            >
              →
            </button>
            <Link
              href="/catalog"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-brand/10 bg-white px-4 text-sm font-black text-brand shadow-sm transition hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-md"
            >
              ყველა ბრენდი
              <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>

        <div className="relative mt-7">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-[#fffaf6] to-transparent sm:w-16"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-[#fffaf6] to-transparent sm:w-16"
          />

          <div
            ref={viewportRef}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            onPointerDown={pauseTemporarily}
            onTouchStart={pauseTemporarily}
            className="scrollbar-none overflow-x-auto overscroll-x-contain py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div className="flex w-max gap-3 pr-3">
              {loop.map((brand, index) => (
                <Link
                  key={`${brand.name}-${index}`}
                  href={`/catalog?brand=${encodeURIComponent(brand.name)}`}
                  className="group flex h-[104px] w-[150px] shrink-0 flex-col justify-between rounded-[22px] border border-[#e5ebe8] bg-white p-3.5 shadow-[0_7px_22px_rgba(7,63,59,0.045)] transition duration-300 hover:-translate-y-1 hover:border-brand/20 hover:shadow-[0_13px_28px_rgba(7,63,59,0.09)] sm:h-[112px] sm:w-[166px] sm:p-4"
                >
                  <div className="flex items-start justify-between gap-2">
                    <BrandMark name={brand.name} domain={brand.domain} />
                    {brand.count > 0 ? (
                      <span className="rounded-full bg-[#ecf8f4] px-2 py-1 text-[10px] font-black text-brand">
                        {brand.count}
                      </span>
                    ) : null}
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black tracking-[-0.02em] text-brand transition group-hover:text-accent sm:text-[15px]">
                        {brand.name}
                      </div>
                      {brand.count > 0 ? (
                        <div className="mt-0.5 text-[10px] font-semibold text-text-soft">აქტიური განცხადება</div>
                      ) : (
                        <div className="mt-0.5 text-[10px] font-semibold text-text-soft">ნახე ბრენდი</div>
                      )}
                    </div>
                    <span
                      aria-hidden="true"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f7f7f4] text-sm font-black text-brand transition group-hover:bg-brand group-hover:text-white"
                    >
                      →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-center gap-2 text-[11px] font-semibold text-text-soft">
          <span className={`h-1.5 w-1.5 rounded-full ${paused ? "bg-accent" : "bg-brand"}`} />
          {paused ? "კარუსელი დროებით შეჩერებულია" : "ავტომატური კარუსელი"}
        </div>
      </div>
    </section>
  )
}
