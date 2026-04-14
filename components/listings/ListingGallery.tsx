"use client"

import { useMemo, useState } from "react"
import SmartImage from "@/components/shared/SmartImage"
import type { ListingImage } from "@/types/marketplace"

const THUMB_SLOTS = 5

export default function ListingGallery({ title, coverImageUrl, images }: { title: string; coverImageUrl: string | null; images: ListingImage[] }) {
  const galleryItems = useMemo(
    () => (images.length > 0 ? images : coverImageUrl ? [{ id: "cover", image_url: coverImageUrl, sort_order: 0 }] : []),
    [coverImageUrl, images],
  )

  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null)

  const activeImageUrl = galleryItems.some((item) => item.image_url === selectedImageUrl)
    ? selectedImageUrl
    : galleryItems[0]?.image_url ?? coverImageUrl ?? null

  const previewItems = Array.from({ length: THUMB_SLOTS }, (_, index) => galleryItems[index] ?? { id: `placeholder-${index}`, image_url: "", sort_order: index })

  return (
    <div className="w-full max-w-[632px] space-y-4">
      <div className="overflow-hidden rounded-[8px] bg-[#24262A]">
        <div className="aspect-square bg-[#24262A]">
          <SmartImage
            src={activeImageUrl}
            alt={title}
            wrapperClassName="h-full w-full"
            className="object-cover"
            fallbackLabel="სურათი არ არის დამატებული"
            loading="eager"
          />
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4">
        {previewItems.map((image) => {
          const isActive = Boolean(image.image_url) && activeImageUrl === image.image_url
          return (
            <button
              type="button"
              key={image.id}
              onClick={() => (image.image_url ? setSelectedImageUrl(image.image_url) : undefined)}
              className={[
                "h-[120px] overflow-hidden rounded-[8px] border bg-[#24262A]",
                isActive ? "border-[#F88A51]" : "border-transparent",
              ].join(" ")}
            >
              {image.image_url ? (
                <SmartImage src={image.image_url} alt={`${title} preview`} wrapperClassName="h-full w-full" className="object-cover" fallbackLabel="thumbnail" />
              ) : (
                <div className="h-full w-full bg-[#24262A]" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
