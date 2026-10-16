import type { StoreHeroContent } from "@/lib/store-hero"
import StoreHeroSurface from "@/components/stores/StoreHeroSurface"
import StoreContactStrip, {type StoreContacts} from "@/components/stores/StoreContactStrip"

type StoreHeroMockupProps = {
  hero: StoreHeroContent
  storeName: string
  username?: string
  city?: string
  logoUrl?: string | null
  coverUrl?: string | null
  caption?: string
  contacts?: StoreContacts
}

export default function StoreHeroMockup({
  hero,
  storeName,
  username,
  city,
  logoUrl,
  coverUrl,
  caption,
  contacts,
}: StoreHeroMockupProps) {
  const name = storeName.trim() || "შენი მაღაზიის სახელი"
  return (
    <StoreHeroSurface coverUrl={coverUrl} aria-label="მაღაზიის ვიტრინის ცოცხალი წინასწარი ნახვა" className="overflow-hidden rounded-[26px] border p-5 shadow-[0_10px_34px_rgba(7,63,59,0.07)] sm:p-8">
      {caption ? <p className="mb-5 text-xs font-bold text-brand">{caption}</p> : null}
      <div className="grid gap-6 md:grid-cols-[1fr_0.9fr] md:items-center">
        <div className="min-w-0">
          {hero.eyebrow ? <p className="text-xs font-semibold tracking-wide text-[color:var(--store-cover-accent)]">{hero.eyebrow}</p> : null}
          <div className="mt-4 flex items-center gap-3">
            {logoUrl ? (
              <div role="img" aria-label="მაღაზიის ლოგო" className="h-16 w-16 shrink-0 rounded-2xl border-2 border-white bg-white bg-contain bg-center bg-no-repeat shadow-sm" style={{backgroundImage: "url('" + logoUrl + "')" }} />
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border-2 border-white bg-brand text-xl font-bold text-white">{name.slice(0, 1)}</div>
            )}
            <div className="min-w-0"><p className="truncate text-sm font-bold text-brand">{name}</p><p className="text-xs text-text-soft">{city || "მაღაზია"}{username ? " · @" + username : ""}</p></div>
          </div>
          <h3 className="mt-5 break-words text-[clamp(1.8rem,3.3vw,3.25rem)] leading-[1.13] tracking-tight text-[#172321]">{hero.headline || name}</h3>
          {(hero.description || !storeName.trim()) ? <p className="mt-5 whitespace-pre-wrap break-words text-sm leading-7 text-text-soft">{hero.description || "აქ გამოჩნდება შენი მაღაზიის აღწერა"}</p> : null}
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="rounded-xl bg-brand px-4 py-3 text-xs font-bold text-white">მიწერა</span>
            <span className="rounded-xl border border-line bg-white px-4 py-3 text-xs font-bold text-brand">გამოწერა</span>
          </div>
          <p className="mt-5 text-xs font-bold text-brand">კოლექციის ნახვა ↗</p>
          {contacts ? <StoreContactStrip contacts={contacts} compact /> : null}
        </div>
        <div className="relative h-[265px] min-w-0 sm:h-[345px]">
          <div
            role="img"
            aria-label={coverUrl ? "მაღაზიის არჩეული ქავერი" : "მაღაზიის ქავერის ადგილი"}
            className="absolute inset-x-0 bottom-10 top-0 flex items-center justify-center overflow-hidden rounded-[24px] bg-[#dcc9bb] bg-cover bg-center"
            style={coverUrl ? {backgroundImage: "url('" + coverUrl + "')"} : undefined}
          >
            {!coverUrl ? <span className="rounded-xl bg-white/85 px-5 py-3 text-center text-xs font-bold text-brand">აქ გამოჩნდება შენი ქავერის ფოტო</span> : null}
          </div>
          {hero.coverTitle || hero.coverSubtitle ? (
            <div className="absolute bottom-0 left-0 max-w-[88%] rounded-[20px] border border-white/80 bg-white/95 p-4 shadow-lg">
              {hero.coverTitle ? <p className="break-words text-base font-bold leading-snug text-brand sm:text-xl">{hero.coverTitle}</p> : null}
              {hero.coverSubtitle ? <p className="mt-2 break-words text-xs text-text-soft">{hero.coverSubtitle}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </StoreHeroSurface>
  )
}
