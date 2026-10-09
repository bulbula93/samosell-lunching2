type SellerActionIconProps = {
  name: "follow" | "following" | "chat" | "share"
  className?: string
}

export default function SellerActionIcon({ name, className = "" }: SellerActionIconProps) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-4 w-4 shrink-0 sm:h-[18px] sm:w-[18px] ${className}`}
    >
      {name === "follow" ? (
        <>
          <path d="M15 19a6 6 0 0 0-12 0" />
          <circle cx="9" cy="7" r="4" />
          <path d="M19 8v8M15 12h8" />
        </>
      ) : name === "following" ? (
        <>
          <path d="M15 19a6 6 0 0 0-12 0" />
          <circle cx="9" cy="7" r="4" />
          <path d="m16 12 2.5 2.5L23 10" />
        </>
      ) : name === "chat" ? (
        <path d="M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 20l.9-4.5a9 9 0 0 1-.9-4A8.5 8.5 0 1 1 20 11.5Z" />
      ) : (
        <>
          <path d="m22 2-7.5 20-4.5-8-8-4.5L22 2Z" />
          <path d="M10 14 22 2" />
        </>
      )}
    </svg>
  )
}
