"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { PERFUME_BRANDS } from "@/lib/perfume-brands"

function BrandLogo({ name, domain }: { name: string; domain: string }) {
  const [failed, setFailed] = useState(false)

  return (
    <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl border border-[#eadfd7] bg-white shadow-[0_3px_12px_rgba(7,63,59,0.05)]">
      {failed ? (
        <span className="text-xs font-black text-brand">{name.slice(0, 2)}</span>
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

export default function PerfumeBrandCarousel() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fractionalScrollRef = useRef(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport || paused) return

    let frame = 0
    let previous = performance.now()

    const tick = (now: number) => {
      const delta = Math.min(now - previous, 40)
      previous = now

      if (!document.hidden) {
        const distance = fractionalScrollRef.current + delta * 0.03
        const pixels = Math.floor(distance)
        fractionalScrollRef.current = distance - pixels

        if (pixels > 0) {
          viewport.scrollLeft += pixels
        }

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

  useEffect(
    () => () => {
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    },
    [],
  )

  function pauseAutoplay() {
    setPaused(true)
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
  }

  function resumeAutoplaySoon() {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current)
    resumeTimerRef.current = setTimeout(() => setPaused(false), 1200)
  }

  const loop = [...PERFUME_BRANDS, ...PERFUME_BRANDS]

  return (
    <section aria-labelledby="perfume-brands-heading" className="mt-6 overflow-hidden rounded-[30px] border border-[#eadfd7] bg-[#fffaf6] p-5 shadow-[0_12px_34px_rgba(7,63,59,0.05)] sm:p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.14em] text-[#d86a1f]">პარფიუმერია</div>
          <h2 id="perfume-brands-heading" className="mt-1 text-xl font-black tracking-[-0.03em] text-brand sm:text-2xl">
            პოპულარული პარფიუმერიის ბრენდები
          </h2>
        </div>
      </div>

      <div className="relative mt-5">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 z-10 w-8 bg-gradient-to-r from-[#fffaf6] to-transparent sm:w-12" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 bg-gradient-to-l from-[#fffaf6] to-transparent sm:w-12" />

        <div
          ref={viewportRef}
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onPointerDown={pauseTemporarily}
          onTouchStart={pauseTemporarily}
          className="touch-pan-x overflow-x-auto overscroll-x-contain py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div className="flex w-max gap-3 pr-3">
            {loop.map((brand, index) => (
              <Link
                key={`${brand.name}-${index}`}
                href={`/catalog?category=perfume&brand=${encodeURIComponent(brand.name)}`}
                className="group flex h-[104px] w-[150px] shrink-0 flex-col items-center justify-center gap-3 rounded-[22px] border border-[#eadfd7] bg-white px-3 py-3 transition duration-300 hover:-translate-y-1 hover:border-[#e7a16f] hover:shadow-[0_12px_28px_rgba(7,63,59,0.08)] sm:w-[160px]"
              >
                <BrandLogo name={brand.name} domain={brand.domain} />
                <div className="w-full truncate text-center text-sm font-black tracking-[-0.02em] text-brand transition group-hover:text-[#d86a1f]">
                  {brand.name}
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
