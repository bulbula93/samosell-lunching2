import { SITE_NAME, SITE_TAGLINE } from "@/lib/site"

type BrandLogoProps = {
  className?: string
  nameClassName?: string
  taglineClassName?: string
  iconSize?: number
  showTagline?: boolean
  iconOnly?: boolean
}

export default function BrandLogo({
  className = "",
  nameClassName = "",
  taglineClassName = "",
  iconSize = 44,
  showTagline = false,
  iconOnly = false,
}: BrandLogoProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`.trim()}>
      <svg
        aria-hidden="true"
        width={iconSize}
        height={iconSize}
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0"
      >
        <rect x="4" y="4" width="56" height="56" rx="18" fill="#F7F1E8" />
        <rect x="4.75" y="4.75" width="54.5" height="54.5" rx="17.25" stroke="#F2C5AE" strokeWidth="1.5" />
        <path
          d="M42.5 18.5C39.4 15.1 34.5 13.4 29.6 14.2C22.9 15.3 18.4 20 18.4 26.2C18.4 32.2 23.2 35 30.2 36.1C37.8 37.3 41.4 39 41.4 43C41.4 47.1 37.4 49.9 31.9 49.9C27.3 49.9 22.8 48 19.9 44.4"
          stroke="#F88A51"
          strokeWidth="5.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="45.5" cy="17.5" r="4" fill="#D6A15B" />
        <path d="M18.5 20.5L22.4 18.2" stroke="#D6A15B" strokeWidth="3.4" strokeLinecap="round" />
      </svg>

      {iconOnly ? null : (
        <div className="min-w-0">
          <div className={`truncate font-bold tracking-tight text-[#F88A51] ${nameClassName}`.trim()}>{SITE_NAME}</div>
          {showTagline ? (
            <div className={`truncate text-text-soft ${taglineClassName}`.trim()}>{SITE_TAGLINE}</div>
          ) : null}
        </div>
      )}
    </div>
  )
}
