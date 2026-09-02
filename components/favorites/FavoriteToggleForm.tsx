import { toggleFavoriteAction } from "@/app/favorites/actions"
import FavoriteSubmitButton from "@/components/favorites/FavoriteSubmitButton"
import { normalizeSearchId } from "@/lib/search-analytics"

type FavoriteToggleFormProps = {
  listingId: string
  listingSlug: string
  nextPath: string
  isFavorited: boolean
  searchId?: string | null
  compact?: boolean
  className?: string
}

export default function FavoriteToggleForm({
  listingId,
  listingSlug,
  nextPath,
  isFavorited,
  searchId = null,
  compact = false,
  className,
}: FavoriteToggleFormProps) {
  const normalizedSearchId = normalizeSearchId(searchId)

  return (
    <form action={toggleFavoriteAction}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="listingSlug" value={listingSlug} />
      <input type="hidden" name="nextPath" value={nextPath} />
      {normalizedSearchId ? (
        <input type="hidden" name="searchId" value={normalizedSearchId} />
      ) : null}
      <FavoriteSubmitButton isFavorited={isFavorited} compact={compact} className={className} />
    </form>
  )
}
