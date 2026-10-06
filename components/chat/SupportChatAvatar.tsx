"use client"

import Image from "next/image"
import { useState } from "react"

export default function SupportChatAvatar({
  sizeClassName = "h-12 w-12",
}: {
  sizeClassName?: string
}) {
  const [failed, setFailed] = useState(false)

  return (
    <div
      role="img"
      aria-label="SamoSell-ის ლოგო"
      className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand/10 bg-white p-1.5 shadow-[0_10px_30px_rgba(23,23,23,0.06)] ring-1 ring-brand/5 ${sizeClassName}`}
    >
      {failed ? (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-none stroke-brand" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 13v-1a8 8 0 0 1 16 0v1M4 12H3v6h3v-6H4Zm16 0h1v6h-3v-6h2Zm0 6a3 3 0 0 1-3 3h-3" />
        </svg>
      ) : (
        <Image
          src="/brand/samosell-header-logo.svg"
          alt=""
          width={900}
          height={275}
          unoptimized
          className="h-full w-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  )
}
