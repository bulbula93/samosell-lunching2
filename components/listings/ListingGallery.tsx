"use client"

import {
  type KeyboardEvent,
  type TouchEvent,
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
  const touchStartRef = useRef<{ x: number; y: number } | null>(null)
  const activeIndex =
    galleryItems.length > 0 ? Math.min(selectedIndex, galleryItems.length - 1) : 0
  const activeItem = galleryItems[activeIndex] ?? null

  function selectImage(index: number, moveFocus = false) {
    if (galleryItems.length === 0) return
    const nextIndex = (index + galleryItems.length) % galleryItems.length
    setSelectedIndex(nextIndex)
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

  function handleTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
  }

  function handleTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = touchStartRef.current
    const touch = event.changedTouches[0]
    touchStartRef.current = null
    if (!start || !touch || galleryItems.length < 2) return

    const deltaX = touch.clientX - start.x
    const deltaY = touch.clientY - start.y
    if (Math.abs(deltaX) < 45 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.15) return

    selectImage(activeIndex + (deltaX < 0 ? 1 : -1))
  }

  return (
    <section aria-label={ka.listingDetail.imageRegion} className="min-w-0">
      <div
        className="ui-card relative aspect-[4/5] touch-pan-y select-none overflow-hidden bg-surface-alt sm:aspect-square"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <SmartImage
          src={activeItem?.image_url}
          alt={
            activeItem
              ? `${title} — ${ka.listingDetail.imageCount} ${activeIndex + 1}`
              : title
          }
          wrapperClassName="h-full w-full"
          className="object-contain"
          fallbackLabel={ka.product.imageUnavailable}
          loading="eager"
          sizes="(max-width: 1023px) 100vw, (max-width: 1439px) 58vw, 720px"
        />

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
