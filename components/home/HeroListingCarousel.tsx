"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import SmartImage from "@/components/shared/SmartImage"
import { formatPrice } from "@/lib/listings"
import type { CatalogListing } from "@/types/marketplace"

const ROTATION_INTERVAL_MS = 5_000

export type HeroListingItem = Pick<
  CatalogListing,
  "id" | "slug" | "title" | "cover_image_url" | "price" | "currency" | "brand_name" | "category_name"
>

type HeroListingCarouselProps = {
  items: HeroListingItem[]
  mode: "vip" | "popular"
}

export default function HeroListingCarousel({ items, mode }: HeroListingCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [pausedByUser, setPausedByUser] = useState(false)
  const [pausedByInteraction, setPausedByInteraction] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setPrefersReducedMotion(mediaQuery.matches)

    updatePreference()
    mediaQuery.addEventListener("change", updatePreference)
    return () => mediaQuery.removeEventListener("change", updatePreference)
  }, [])

  useEffect(() => {
    if (items.length < 2 || pausedByUser || pausedByInteraction || prefersReducedMotion) return

    const intervalId = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % items.length)
    }, ROTATION_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [items.length, pausedByInteraction, pausedByUser, prefersReducedMotion])

  const activeItem = items[activeIndex] ?? items[0]
  const label = mode === "vip" ? "VIP განცხადებები" : "პოპულარული ნივთები"
  const badge = mode === "vip" ? "VIP" : "პოპულარული"

  function showPrevious() {
    setActiveIndex((current) => (current - 1 + items.length) % items.length)
  }

  function showNext() {
    setActiveIndex((current) => (current + 1) % items.length)
  }

  return (
    <div
      role="region"
      aria-roledescription="კარუსელი"
      aria-label={label}
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault()
          showPrevious()
        }
        if (event.key === "ArrowRight") {
          event.preventDefault()
          showNext()
        }
      }}
      onMouseEnter={() => setPausedByInteraction(true)}
      onMouseLeave={() => setPausedByInteraction(false)}
      onFocusCapture={() => setPausedByInteraction(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setPausedByInteraction(false)
        }
      }}
      className="group relative h-full overflow-hidden rounded-[32px] border border-[#e8c778]/55 bg-[#062f2c] p-3 shadow-[0_28px_80px_rgba(7,63,59,0.2)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
    >
      <Link
        key={activeItem.id}
        href={`/listing/${activeItem.slug}`}
        aria-label={`${badge} განცხადება: ${activeItem.title}`}
        className="relative block h-full overflow-hidden rounded-[23px] bg-brand"
      >
        <SmartImage
          src={activeItem.cover_image_url}
          alt={activeItem.title}
          wrapperClassName="h-full w-full"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.025]"
          fallbackLabel={`${activeItem.title} — ფოტო არ არის`}
          loading="eager"
          sizes="(max-width: 767px) 92vw, (max-width: 1279px) 45vw, 520px"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,28,26,0.06)_20%,rgba(3,28,26,0.92)_100%)]" />
        <div className="absolute left-4 top-4 rounded-full border border-[#f6d98e]/60 bg-[#102f2b]/90 px-3.5 py-1.5 text-[11px] font-black tracking-[0.14em] text-[#f6d98e] shadow-sm backdrop-blur">
          {badge}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-5 pr-20 text-white sm:p-7 sm:pr-24">
          <p className="text-xs font-semibold text-white/70">
            {[activeItem.brand_name, activeItem.category_name].filter(Boolean).join(" · ")}
          </p>
          <h2 className="mt-2 line-clamp-2 text-2xl font-bold leading-tight tracking-[-0.025em] sm:text-3xl">
            {activeItem.title}
          </h2>
          <p className="mt-3 text-xl font-black text-[#f6d98e]">
            {formatPrice(activeItem.price, activeItem.currency)}
          </p>
        </div>
      </Link>

      {items.length > 1 ? (
        <>
          <div className="absolute right-5 top-5 z-20 flex gap-2">
            <button
              type="button"
              onClick={showPrevious}
              aria-label="წინა განცხადება"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-[#062f2c]/85 text-xl text-white shadow-sm backdrop-blur transition hover:bg-[#0a514b]"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              onClick={showNext}
              aria-label="შემდეგი განცხადება"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/25 bg-[#062f2c]/85 text-xl text-white shadow-sm backdrop-blur transition hover:bg-[#0a514b]"
            >
              <span aria-hidden="true">›</span>
            </button>
            <button
              type="button"
              onClick={() => setPausedByUser((current) => !current)}
              aria-label={pausedByUser ? "ავტომატური მონაცვლეობის გაგრძელება" : "ავტომატური მონაცვლეობის შეჩერება"}
              aria-pressed={pausedByUser}
              className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-white/25 bg-[#062f2c]/85 px-3 text-sm font-bold text-white shadow-sm backdrop-blur transition hover:bg-[#0a514b]"
            >
              <span aria-hidden="true">{pausedByUser ? "▶" : "Ⅱ"}</span>
            </button>
          </div>

          <div className="absolute bottom-6 right-6 z-20 flex items-center gap-2" aria-label="განცხადების არჩევა">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`${index + 1}-ე განცხადების ჩვენება`}
                aria-current={index === activeIndex ? "true" : undefined}
                className={`h-2.5 rounded-full border border-white/70 transition-all ${index === activeIndex ? "w-7 bg-[#f6d98e]" : "w-2.5 bg-white/55 hover:bg-white"}`}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
