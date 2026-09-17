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
}

type VisualPosition = "far-left" | "left" | "center" | "right" | "far-right"

export default function HeroListingCarousel({ items }: HeroListingCarouselProps) {
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

  useEffect(() => {
    if (activeIndex < items.length) return
    setActiveIndex(0)
  }, [activeIndex, items.length])

  const activeItem = items[activeIndex] ?? items[0]
  const label = "VIP MAX განცხადებები"
  const badge = "VIP MAX"

  function showPrevious() {
    setActiveIndex((current) => (current - 1 + items.length) % items.length)
  }

  function showNext() {
    setActiveIndex((current) => (current + 1) % items.length)
  }

  function getVisualPosition(index: number): VisualPosition {
    if (index === activeIndex) return "center"

    if (items.length === 2) {
      return index === (activeIndex + 1) % items.length ? "right" : "left"
    }

    const forwardDistance = (index - activeIndex + items.length) % items.length
    const backwardDistance = forwardDistance - items.length
    const offset = Math.abs(backwardDistance) < Math.abs(forwardDistance) ? backwardDistance : forwardDistance

    if (offset === -1) return "left"
    if (offset === 1) return "right"
    return offset < 0 ? "far-left" : "far-right"
  }

  function positionStyles(position: VisualPosition): React.CSSProperties {
    switch (position) {
      case "center":
        return {
          transform: "translate3d(0%, 0, 0) scale(1) rotateY(0deg)",
          opacity: 1,
          zIndex: 30,
        }
      case "left":
        return {
          transform: "translate3d(-70%, 0, -90px) scale(0.82) rotateY(9deg)",
          opacity: 0.88,
          zIndex: 20,
        }
      case "right":
        return {
          transform: "translate3d(70%, 0, -90px) scale(0.82) rotateY(-9deg)",
          opacity: 0.88,
          zIndex: 20,
        }
      case "far-left":
        return {
          transform: "translate3d(-138%, 0, -180px) scale(0.68) rotateY(16deg)",
          opacity: 0,
          zIndex: 10,
          pointerEvents: "none",
        }
      case "far-right":
        return {
          transform: "translate3d(138%, 0, -180px) scale(0.68) rotateY(-16deg)",
          opacity: 0,
          zIndex: 10,
          pointerEvents: "none",
        }
    }
  }

  function renderCard(item: HeroListingItem, index: number) {
    const position = getVisualPosition(index)
    const isCenter = position === "center"
    const isSide = position === "left" || position === "right"

    return (
      <Link
        key={item.id}
        href={`/listing/${item.slug}`}
        aria-label={`${badge} განცხადება: ${item.title}`}
        aria-hidden={!isCenter && !isSide ? true : undefined}
        tabIndex={!isCenter && !isSide ? -1 : undefined}
        style={positionStyles(position)}
        className={`group/card absolute inset-y-0 left-0 right-0 mx-auto block w-[92%] overflow-hidden rounded-[26px] border border-[#e8c778]/45 bg-brand shadow-[0_22px_60px_rgba(7,63,59,0.18)] will-change-transform focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand sm:w-[60%] ${
          prefersReducedMotion
            ? "transition-none"
            : "transition-[transform,opacity,filter] duration-[780ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
        }`}
      >
        <SmartImage
          src={item.cover_image_url}
          alt={item.title}
          wrapperClassName="h-full w-full"
          className={`h-full w-full object-cover transition duration-500 group-hover/card:scale-[1.035] ${isCenter ? "" : "saturate-[0.9]"}`}
          fallbackLabel={`${item.title} — ფოტო არ არის`}
          loading={isCenter ? "eager" : "lazy"}
          sizes={isCenter ? "(max-width: 639px) 92vw, (max-width: 1279px) 58vw, 520px" : "(max-width: 1279px) 40vw, 340px"}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,28,26,0.04)_16%,rgba(3,28,26,0.96)_100%)]" />
        <div className={`absolute rounded-full border border-[#f6d98e]/60 bg-[#102f2b]/90 font-black tracking-[0.14em] text-[#f6d98e] shadow-sm backdrop-blur ${isCenter ? "left-5 top-5 px-4 py-2 text-[11px]" : "left-4 top-4 px-3 py-1.5 text-[10px]"}`}>
          {badge}
        </div>
        <div className={`absolute inset-x-0 bottom-0 text-white ${isCenter ? "p-6 pr-8 sm:p-8" : "p-4 sm:p-5"}`}>
          <p className={`${isCenter ? "text-xs" : "text-[10px]"} line-clamp-1 font-semibold text-white/70`}>
            {[item.brand_name, item.category_name].filter(Boolean).join(" · ")}
          </p>
          <h2 className={`mt-2 line-clamp-2 font-bold leading-tight tracking-[-0.025em] ${isCenter ? "text-2xl sm:text-3xl" : "text-base sm:text-lg"}`}>
            {item.title}
          </h2>
          <p className={`mt-3 font-black text-[#f6d98e] ${isCenter ? "text-xl" : "text-base"}`}>
            {formatPrice(item.price, item.currency)}
          </p>
          <span className={`mt-4 inline-flex items-center gap-2 rounded-xl bg-[#f6d98e] font-black text-[#073f3b] shadow-sm transition group-hover/card:bg-white ${isCenter ? "px-4 py-2.5 text-sm" : "px-3 py-2 text-xs"}`}>
            ნახე განცხადება <span aria-hidden="true">→</span>
          </span>
        </div>
      </Link>
    )
  }

  if (!activeItem) return null

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
      className="relative h-full w-full overflow-visible focus-visible:outline-none"
      style={{ perspective: "1200px" }}
    >
      <p className="sr-only" aria-live="polite">აქტიური VIP MAX განცხადება: {activeItem.title}</p>

      <div className="relative h-full w-full [transform-style:preserve-3d]">
        {items.map((item, index) => renderCard(item, index))}
      </div>

      {items.length > 1 ? (
        <>
          <button
            type="button"
            onClick={showPrevious}
            aria-label="წინა განცხადება"
            className="absolute left-2 top-1/2 z-40 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#073f3b]/10 bg-white/95 text-2xl text-[#073f3b] shadow-lg backdrop-blur transition duration-200 hover:scale-105 hover:bg-[#f6d98e] sm:left-[18%] lg:left-[17%]"
          >
            <span aria-hidden="true">‹</span>
          </button>
          <button
            type="button"
            onClick={showNext}
            aria-label="შემდეგი განცხადება"
            className="absolute right-2 top-1/2 z-40 inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-[#073f3b]/10 bg-white/95 text-2xl text-[#073f3b] shadow-lg backdrop-blur transition duration-200 hover:scale-105 hover:bg-[#f6d98e] sm:right-[18%] lg:right-[17%]"
          >
            <span aria-hidden="true">›</span>
          </button>

          <div className="absolute -bottom-8 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2" aria-label="განცხადების არჩევა">
            {items.map((item, index) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveIndex(index)}
                aria-label={`${index + 1}-ე განცხადების ჩვენება`}
                aria-current={index === activeIndex ? "true" : undefined}
                className={`h-2.5 rounded-full border border-brand/30 transition-all duration-300 ${index === activeIndex ? "w-7 bg-brand" : "w-2.5 bg-brand/20 hover:bg-brand/45"}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => setPausedByUser((current) => !current)}
            aria-label={pausedByUser ? "ავტომატური მონაცვლეობის გაგრძელება" : "ავტომატური მონაცვლეობის შეჩერება"}
            aria-pressed={pausedByUser}
            className="absolute -bottom-10 right-0 z-40 inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-brand/15 bg-white/85 px-2 text-[11px] font-bold text-brand shadow-sm backdrop-blur transition hover:bg-white"
          >
            <span aria-hidden="true">{pausedByUser ? "▶" : "Ⅱ"}</span>
          </button>
        </>
      ) : null}
    </div>
  )
}
