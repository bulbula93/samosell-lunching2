import SmartImage from "@/components/shared/SmartImage"
import { getInitials } from "@/lib/profiles"

type AvatarProps = {
  src?: string | null
  alt: string
  fallbackText?: string | null
  sizeClassName?: string
  className?: string
  textClassName?: string
}

export default function Avatar({
  src,
  alt,
  fallbackText,
  sizeClassName = "h-12 w-12",
  className = "",
  textClassName = "text-base",
}: AvatarProps) {
  const initials = getInitials(fallbackText || alt)

  if (src) {
    return (
      <div className={`overflow-hidden rounded-full border border-white/80 bg-neutral-100 shadow-[0_10px_30px_rgba(23,23,23,0.08)] ring-1 ring-neutral-200/80 ${sizeClassName} ${className}`}>
        <SmartImage src={src} alt={alt} wrapperClassName="h-full w-full" className="object-cover" fallbackLabel={initials} />
      </div>
    )
  }

  return (
    <div className={`inline-flex items-center justify-center rounded-full border border-brand/10 bg-brand-soft font-black text-brand shadow-[0_10px_30px_rgba(23,23,23,0.06)] ring-1 ring-brand/5 ${sizeClassName} ${textClassName} ${className}`}>
      {initials}
    </div>
  )
}
