import { toggleFavoriteAction } from "@/app/favorites/actions"
import FavoriteSubmitButton from "@/components/favorites/FavoriteSubmitButton"

type FavoriteToggleFormProps = {
  listingId: string
  listingSlug: string
  nextPath: string
  isFavorited: boolean
  compact?: boolean
  className?: string
}

export default function FavoriteToggleForm({
  listingId,
  listingSlug,
  nextPath,
  isFavorited,
  compact = false,
  className,
}: FavoriteToggleFormProps) {
  return (
    <form action={toggleFavoriteAction}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="listingSlug" value={listingSlug} />
      <input type="hidden" name="nextPath" value={nextPath} />
      <FavoriteSubmitButton isFavorited={isFavorited} compact={compact} className={className} />
    </form>
  )
}
