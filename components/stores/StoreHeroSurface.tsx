"use client"

import { useEffect, useState, type ComponentPropsWithoutRef, type CSSProperties } from "react"
import { readStoreCoverColor } from "@/lib/store-cover-color-client"
import { createStoreCoverTheme, DEFAULT_STORE_COVER_THEME, type CoverRgb } from "@/lib/store-cover-theme"

type Props = ComponentPropsWithoutRef<"section"> & {
  as?: "div" | "section"
  coverUrl?: string | null
}

export default function StoreHeroSurface({ as: Tag = "section", coverUrl, style, ...props }: Props) {
  const source = coverUrl?.trim() || ""
  const [sample, setSample] = useState<{ source: string; color: CoverRgb | null } | null>(null)
  useEffect(() => {
    if (!source) return
    let active = true
    void readStoreCoverColor(source).then(color => {
      if (active) setSample({ source, color })
    })
    return () => { active = false }
  }, [source])
  // A replaced/removed cover immediately gets the fallback, even if the old
  // image decode finishes later. Server output and first hydration also match.
  const color = sample?.source === source ? sample.color : null
  const theme = color ? createStoreCoverTheme(color) : DEFAULT_STORE_COVER_THEME
  return <Tag {...props} data-store-cover-theme={color ? "image" : "default"} style={{
    ...style,
    backgroundColor: theme.backgroundColor,
    backgroundImage: theme.backgroundImage,
    borderColor: theme.borderColor,
    "--store-cover-accent": theme.accent,
  } as CSSProperties} />
}
