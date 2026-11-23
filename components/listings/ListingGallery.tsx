"use client"

import {
  type KeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import SmartImage from "@/components/shared/SmartImage"
import { ka } from "@/lib/i18n/ka"
import { getSafeImageSource } from "@/lib/media"
import type { ListingImage } from "@/types/marketplace"

type ListingGalleryProps = {
  title: string
  coverImageUrl: string | null
  images: ListingImage[]
}

export function buildGalleryItems(coverImageUrl: string | null, images: ListingImage[]) {
  const candidates = [
    ...images
      .toSorted((left, right) => left.sort_order - right.sort_order)
      .map((image) => ({ id: image.id, image_url: image.image_url })),
    ...(coverImageUrl ? [{ id: "cover", image_url: coverImageUrl }] : []),
  ]
  const seen = new Set<string>()

  return candidates.flatMap((item) => {
    const safeSource = getSafeImageSource(item.image_url)
    if (!safeSource || seen.has(safeSource)) return []
    seen.add(safeSource)
    return [{ ...item, image_url: safeSource }]
  })
}

export default function ListingGallery({
  title,
  coverImageUrl,
  images,
}: ListingGalleryProps) {
  const galleryItems = useMemo(
    () => buildGalleryItems(coverImageUrl, images),
    [coverImageUrl, images],
  )
  const [selectedIndex, setSelectedIndex] = useState(0)
  const thumbnailRefs = useRef<Array<HTMLButtonElement | null>>([])
  const trackRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)
  const activeIndex =
    galleryItems.length > 0 ? Math.min(selectedIndex, galleryItems.length - 1) : 0

  // Native swipe: photos sit side by side in a scroll-snap track, so the photo follows the
  // finger (compositor-driven, no JS per frame). The active index is read back from the scroll.
  const syncFromScroll = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      const track = trackRef.current
      if (!track || track.clientWidth === 0) return
      const index = Math.round(track.scrollLeft / track.clientWidth)
      setSelectedIndex(Math.max(0, Math.min(index, galleryItems.length - 1)))
    })
  }, [galleryItems.length])

  useEffect(() => () => cancelAnimationFrame(frameRef.current), [])

  function selectImage(index: number, moveFocus = false) {
    if (galleryItems.length === 0) return
    const nextIndex = (index + galleryItems.length) % galleryItems.length
    setSelectedIndex(nextIndex)
    const track = trackRef.current
    if (track && typeof track.scrollTo === "function") {
      const reduceMotion = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
      // A wrap-around (last → first) jumps instead of scrolling past every photo.
      const wraps = Math.abs(nextIndex - activeIndex) > 1
      track.scrollTo({ left: nextIndex * track.clientWidth, behavior: reduceMotion || wraps ? "auto" : "smooth" })
    }
    if (moveFocus) thumbnailRefs.current[nextIndex]?.focus()
  }

  function handleThumbnailKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      selectImage(index + 1, true)
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      selectImage(index - 1, true)
    } else if (event.key === "Home") {
      event.preventDefault()
      selectImage(0, true)
    } else if (event.key === "End") {
      event.preventDefault()
      selectImage(galleryItems.length - 1, true)
    }
  }

  return (
    <section aria-label={ka.listingDetail.imageRegion} className="min-w-0">
      <div className="ui-card relative aspect-[4/5] select-none overflow-hidden bg-surface-alt sm:aspect-square">
        {galleryItems.length === 0 ? (
          <SmartImage
            src={null}
            alt={title}
            wrapperClassName="h-full w-full"
            fallbackLabel={ka.product.imageUnavailable}
          />
        ) : (
          <div
            ref={trackRef}
            onScroll={syncFromScroll}
            data-testid="gallery-track"
            className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {galleryItems.map((item, index) => {
              const near = Math.abs(index - activeIndex) <= 1
              return (
                <div
                  key={item.id}
                  className="h-full w-full shrink-0 snap-center snap-always [contain:paint]"
                  aria-hidden={index === activeIndex ? undefined : true}
                >
                  <SmartImage
                    src={item.image_url}
                    alt={`${title} — ${ka.listingDetail.imageCount} ${index + 1}`}
                    wrapperClassName="h-full w-full"
                    // Blurred backdrops are costly while scrolling: only the visible photo and its neighbours get one.
                    fit="contain"
                    backdrop={near}
                    fallbackLabel={ka.product.imageUnavailable}
                    // First photo loads first; the neighbours start loading before the swipe reaches them.
                    loading={index === 0 || near ? "eager" : "lazy"}
                    sizes="(max-width: 1023px) 100vw, (max-width: 1439px) 58vw, 720px"
                  />
                </div>
              )
            })}
          </div>
        )}

        {galleryItems.length > 1 ? (
          <>
            <button
              type="button"
              onClick={() => selectImage(activeIndex - 1)}
              aria-label={ka.listingDetail.previousImage}
              className="absolute left-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white/95 text-xl font-bold text-text shadow-lg transition hover:bg-brand hover:text-white sm:inline-flex"
            >
              <span aria-hidden="true">‹</span>
            </button>
            <button
              type="button"
              onClick={() => selectImage(activeIndex + 1)}
              aria-label={ka.listingDetail.nextImage}
              className="absolute right-3 top-1/2 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white/95 text-xl font-bold text-text shadow-lg transition hover:bg-brand hover:text-white sm:inline-flex"
            >
              <span aria-hidden="true">›</span>
            </button>

            {galleryItems.length <= 7 ? (
              <div
                aria-hidden="true"
                className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-2.5 py-2 backdrop-blur-sm sm:hidden"
              >
                {galleryItems.map((item, index) => (
                  <span
                    key={item.id}
                    className={[
                      "h-1.5 rounded-full transition-all",
                      index === activeIndex ? "w-5 bg-white" : "w-1.5 bg-white/60",
                    ].join(" ")}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}

        {galleryItems.length > 0 ? (
          <div
            aria-live="polite"
            aria-atomic="true"
            className="absolute bottom-3 right-3 rounded-full bg-text/85 px-3 py-1.5 text-xs font-bold text-white"
          >
            {activeIndex + 1} / {galleryItems.length}
          </div>
        ) : null}
      </div>

      {galleryItems.length > 1 ? (
        <>
          <p className="mt-2 text-center text-[11px] font-semibold text-text-soft sm:hidden">
            ფოტოების სანახავად გადაუსვი მარცხნივ ან მარჯვნივ
          </p>
          <div
            role="tablist"
            aria-label={ka.listingDetail.imageRegion}
            className="mt-3 hidden gap-3 overflow-x-auto pb-2 sm:flex"
          >
            {galleryItems.map((image, index) => {
              const isActive = activeIndex === index
              return (
                <button
                  key={image.id}
                  ref={(node) => {
                    thumbnailRefs.current[index] = node
                  }}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`${ka.listingDetail.imageCount} ${index + 1}`}
                  tabIndex={isActive ? 0 : -1}
                  onClick={() => selectImage(index)}
                  onKeyDown={(event) => handleThumbnailKeyDown(event, index)}
                  className={[
                    "relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl border-2 bg-surface-alt transition sm:w-24",
                    isActive
                      ? "border-brand shadow-[0_0_0_3px_rgba(7,90,83,0.12)]"
                      : "border-transparent hover:border-line",
                  ].join(" ")}
                >
                  <SmartImage
                    src={image.image_url}
                    alt={`${title} — ${ka.listingDetail.imageCount} ${index + 1}`}
                    wrapperClassName="h-full w-full"
                    className="object-cover"
                    fallbackLabel=""
                    sizes="96px"
                  />
                </button>
              )
            })}
          </div>
        </>
      ) : null}
    </section>
  )
}
