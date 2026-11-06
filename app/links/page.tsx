import type { Metadata } from "next"
import Link from "next/link"
import { listingPriceLabel } from "@/lib/listings"
import { getLinkInBioData, type BioListing } from "@/lib/social/link-in-bio"

// Instagram "link in bio": static, regenerated at most every 10 minutes (CDN-served, no per-visit work).
export const revalidate = 600

export const metadata: Metadata = {
  title: "SamoSell — Instagram-ზე ნანახი ნივთები",
  description: "ნივთები, რომლებიც SamoSell-მა Instagram-სა და Facebook-ზე გამოაქვეყნა — თითოეულზე პირდაპირი ბმულით.",
  alternates: { canonical: "https://samosell.ge/links" },
  // Thin hub page for social traffic; listing pages themselves are the indexable content.
  robots: { index: false, follow: true },
}

const UTM = "utm_source=instagram&utm_medium=bio&utm_campaign=agent_os"

function Card({ item }: { item: BioListing }) {
  return (
    <Link href={`/listing/${encodeURIComponent(item.slug)}?${UTM}`} className="group block overflow-hidden rounded-2xl border border-line bg-white shadow-sm active:scale-[0.99]">
      {/* eslint-disable-next-line @next/next/no-img-element -- public storage CDN image; avoids Vercel image-optimizer cost */}
      <img src={item.image} alt={item.title} loading="lazy" decoding="async" className="aspect-[4/5] w-full object-cover" />
      <div className="p-3">
        <p className="line-clamp-2 text-sm font-semibold text-text">{item.title}</p>
        <p className="mt-1 text-sm font-bold text-brand">{listingPriceLabel(item.price, item.currency, item.saleType)}</p>
      </div>
    </Link>
  )
}

function Grid({ items }: { items: BioListing[] }) {
  return <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{items.map(item => <Card key={item.id} item={item} />)}</div>
}

export default async function LinksPage() {
  const { posted, latest } = await getLinkInBioData()
  return (
    <main className="mx-auto max-w-2xl px-4 py-6">
      <header className="text-center">
        <h1 className="text-2xl font-black text-text">SamoSell</h1>
        <p className="mt-1 text-sm text-text-soft">იყიდე და გაყიდე ტანსაცმელი · განცხადება უფასოა · საკომისიო 0%</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Link href={`/?${UTM}`} className="rounded-full bg-text px-4 py-3 text-sm font-bold text-white">🛍️ ყველა ნივთი</Link>
          <Link href={`/sell?${UTM}`} className="rounded-full border border-text px-4 py-3 text-sm font-bold text-text">➕ გაყიდე უფასოდ</Link>
        </div>
      </header>

      {posted.length > 0 ? (
        <section className="mt-8" aria-labelledby="posted">
          <h2 id="posted" className="mb-3 text-lg font-bold text-text">📸 პოსტებიდან</h2>
          <p className="mb-3 text-sm text-text-soft">დააჭირე ნივთს — გაიხსნება მისი გვერდი, სადაც გამყიდველს პირდაპირ მისწერ.</p>
          <Grid items={posted} />
        </section>
      ) : null}

      {latest.length > 0 ? (
        <section className="mt-8" aria-labelledby="latest">
          <h2 id="latest" className="mb-3 text-lg font-bold text-text">✨ ახალი განცხადებები</h2>
          <Grid items={latest} />
        </section>
      ) : null}
    </main>
  )
}
