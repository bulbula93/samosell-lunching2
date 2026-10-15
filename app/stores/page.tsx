import type { Metadata } from "next"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"
import SmartImage from "@/components/shared/SmartImage"
import StoreVipCard, { type StoreVipListing } from "@/components/stores/StoreVipCard"
import { createPublicServerClient } from "@/lib/supabase/public-server"

type StoreProfile = {
  id: string
  username: string | null
  full_name: string | null
  bio: string | null
  city: string | null
  store_logo_url: string | null
  store_banner_url: string | null
}

type StoreParams = { demo?: string | string[]; q?: string | string[] }

const demoStores = [
  { name: "სტუდიო არქივი", city: "თბილისი", kind: "რჩეული ვინტაჟი", description: "გამორჩეული ვინტაჟური სამოსი და აქსესუარები", photo: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=75", initials: "SA", backdrop: "#ddd2c2" },
  { name: "მეორე თავი", city: "თბილისი", kind: "მეორადი", description: "მეორე სიცოცხლე შენს საყვარელ ნივთებს", photo: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=75", initials: "SC", backdrop: "#d7e4d9" },
  { name: "კვირის რჩეული", city: "ბათუმი", kind: "მეორედ აღმოჩენილი სტილი", description: "შერჩეული სტილი ყოველდღიური გარდერობისთვის", photo: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=75", initials: "SE", backdrop: "#e8d5bc" },
]

const demoVipListings: StoreVipListing[] = [
  {
    id: "demo-vip-studio", slug: "demo-vip-studio", title: "ვინტაჟური ჟაკეტი",
    price: 85, currency: "GEL", sale_type: "sell",
    cover_image_url: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=75",
    is_vip: true, is_featured: true, promotion_tier: 3, published_at: null,
    seller_id: "demo-store-1", seller_username: "demo-studio",
    seller_full_name: "სტუდიო არქივი", seller_store_logo_url: null,
  },
  {
    id: "demo-vip-second", slug: "demo-vip-second", title: "კლასიკური ტყავის ჩანთა",
    price: 70, currency: "GEL", sale_type: "sell",
    cover_image_url: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=900&q=75",
    is_vip: true, is_featured: false, promotion_tier: 2, published_at: null,
    seller_id: "demo-store-2", seller_username: "demo-second",
    seller_full_name: "მეორე თავი", seller_store_logo_url: null,
  },
  {
    id: "demo-vip-sunday", slug: "demo-vip-sunday", title: "ვინტაჟური ტრენჩი",
    price: 140, currency: "GEL", sale_type: "sell",
    cover_image_url: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=900&q=75",
    is_vip: true, is_featured: false, promotion_tier: 1, published_at: null,
    seller_id: "demo-store-3", seller_username: "demo-sunday",
    seller_full_name: "კვირის რჩეული", seller_store_logo_url: null,
  },
]

export async function generateMetadata({ searchParams }: { searchParams?: Promise<StoreParams> }): Promise<Metadata> {
  const { demo } = (await searchParams) ?? {}
  return {
    title: "მაღაზიები — აღმოაჩინე შერჩეული მაღაზიები",
    description: "აღმოაჩინე ქართული მაღაზიები და მათი განცხადებები SamoSell-ზე.",
    alternates: { canonical: "/stores" },
    ...(demo === "1" ? { robots: { index: false, follow: false } } : {}),
  }
}

export default async function StoresPage({ searchParams }: { searchParams?: Promise<StoreParams> }) {
  const params = (await searchParams) ?? {}
  const demo = params.demo === "1"
  const q = (typeof params.q === "string" ? params.q : "").trim().slice(0, 80)
  let stores: StoreProfile[] = []
  let vipListings: StoreVipListing[] = []
  let temporarilyUnavailable = false
  let vipUnavailable = false

  if (!demo) {
    try {
      const supabase = createPublicServerClient()
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, bio, city, store_logo_url, store_banner_url")
        .eq("seller_type", "store")
        .eq("is_suspended", false)
        .order("created_at", { ascending: false })
        .limit(60)
      if (error) throw error
      stores = (data ?? []).filter((profile) => Boolean(profile.username)) as StoreProfile[]
      if (stores.length > 0) {
        const activeStoreIds = new Set(stores.map((store) => store.id))
        try {
          const vipResponse = await supabase
            .from("listings_catalog")
            .select("id, slug, title, price, currency, sale_type, cover_image_url, is_vip, is_featured, promotion_tier, published_at, seller_id, seller_username, seller_full_name, seller_store_logo_url")
            .eq("status", "active")
            .eq("seller_type", "store")
            .eq("is_vip", true)
            .not("cover_image_url", "is", null)
            .order("promotion_tier", { ascending: false })
            .order("published_at", { ascending: false })
            .limit(24)
          if (vipResponse.error) throw vipResponse.error
          vipListings = (vipResponse.data ?? [])
            .filter((listing) => Boolean(listing.seller_username) && activeStoreIds.has(listing.seller_id))
            .slice(0, 6) as StoreVipListing[]
        } catch (error) {
          vipUnavailable = true
          console.warn("stores_vip_unavailable", error instanceof Error ? error.message : "unknown")
        }
      }
    } catch (error) {
      temporarilyUnavailable = true
      console.warn("stores_directory_unavailable", error instanceof Error ? error.message : "unknown")
    }
  }

  const search = q.toLocaleLowerCase("ka")
  const shownStores = stores.filter((store) =>
    !search || [store.full_name, store.username, store.city, store.bio].some((text) => String(text ?? "").toLocaleLowerCase("ka").includes(search))
  )
  const shownDemo = demoStores.filter((store) =>
    !search || [store.name, store.city, store.description, store.kind].some((text) => text.toLocaleLowerCase("ka").includes(search))
  )
  const displayVipListings = demo ? demoVipListings : vipListings

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-bg text-text">
        <div className="bg-white px-3 pb-8 pt-4 sm:px-4 sm:pb-12">
          <div className="ui-container !px-0">
            <section className="relative overflow-hidden rounded-[30px] border border-[#e8ded3] bg-[#ead0bd] bg-cover bg-center bg-no-repeat shadow-[0_18px_60px_rgba(7,63,59,0.08)]" style={{ backgroundImage: "url('/brand/samosell-shops-boutique.webp')" }}>
              <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,251,246,0.92)_0%,rgba(255,251,246,0.79)_38%,rgba(255,251,246,0.03)_72%,rgba(255,251,246,0.0)_100%)]" />
              <div className="relative grid min-h-[550px] items-center gap-7 px-6 py-9 sm:px-10 sm:py-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12 lg:px-14">
                <div className="relative z-10 max-w-2xl">
                  <p className="text-xs font-black tracking-[0.18em] text-brand">SamoSell-ის რჩეული · მაღაზიები</p>
                  <h1 className="mt-5 max-w-[14ch] text-balance text-[clamp(2.5rem,5vw,4.65rem)] font-normal leading-[1.08] tracking-[-0.04em] text-[#172321]">
                    შენი <span className="text-[#b37f65]">ახალი</span> აღმოჩენა.
                  </h1>
                  <div className="mt-6 max-w-lg rounded-2xl bg-[#fffaf5]/80 px-4 py-3 backdrop-blur-[3px] sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                    <p className="text-base leading-8 text-text-soft sm:text-lg">ქართული მაღაზიები, გამორჩეული კოლექციები და ნივთები, რომლებსაც ახალი ისტორიის დაწყება შეუძლიათ.</p>
                    <p className="mt-4 text-sm font-semibold text-text-soft">მეორედ აღმოჩენილი / თავიდან შეყვარებული</p>
                  </div>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <a href="#discover-stores" className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-black text-white transition hover:bg-brand-hover">აღმოაჩინე მაღაზიები ↗</a>
                    <Link href="/for-stores" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-brand/15 bg-white/90 px-6 text-sm font-black text-brand transition hover:border-brand/30 hover:bg-white">გახსენი მაღაზია</Link>
                  </div>
                  <div className="mt-8 flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-brand">
                    <span>ვინტაჟი</span><span>მეორადი</span><span>დამოუკიდებელი მაღაზიები</span>
                  </div>
                </div>
                <div className="relative z-10 flex min-h-48 items-center justify-end lg:h-[420px]">
                  {displayVipListings[0] ? (
                    <div className="w-full max-w-[405px]">
                      <StoreVipCard item={displayVipListings[0]} demo={demo} featured />
                    </div>
                  ) : (
                    <div className="w-full max-w-[405px] rounded-[28px] border border-white/75 bg-white/90 px-6 py-8 text-center shadow-[0_22px_58px_rgba(7,63,59,0.14)] backdrop-blur-md sm:p-9">
                      <div aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft text-xl text-[#e9964f]">★</div>
                      <h2 className="mt-4 text-2xl font-bold text-brand">მაღაზიების VIP განცხადებები</h2>
                      <p className="mt-3 text-sm leading-7 text-text-soft">აქ გამოჩნდება მაღაზიების აქტიური VIP განცხადებები — პროდუქტის ფოტოთი, მაღაზიის სახელითა და ლოგოთი.</p>
                      <Link href="/for-stores" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-accent px-6 text-sm font-black text-brand transition hover:bg-accent-hover">გაიგე მეტი ↗</Link>
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
        <div className="ui-container pb-16 sm:pb-20">
          <section aria-labelledby="store-vip-heading" className="scroll-mt-28 border-b border-line pb-11 pt-11 sm:pb-16 sm:pt-16">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-bold text-[#b47b5d]">მაღაზიების გამორჩეული ნივთები</p>
                <h2 id="store-vip-heading" className="mt-2 text-3xl font-semibold tracking-tight text-brand sm:text-4xl">მაღაზიების VIP განცხადებები</h2>
                <p className="mt-3 text-sm leading-7 text-text-soft">ნახე პროდუქტი, მისი ფასი და პირდაპირ გადადი მაღაზიის პროფილზე.</p>
              </div>
              {demo ? <span className="rounded-full border border-[#e6c9a9] bg-[#fff3e5] px-4 py-2 text-xs font-bold text-[#91613d]">დიზაინის დემო — საჩვენებელი მონაცემები</span> : null}
            </div>
            {displayVipListings.length > 0 ? (
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {displayVipListings.map((item) => <StoreVipCard key={item.id} item={item} demo={demo} />)}
              </div>
            ) : (
              <div role="status" className="mt-7 rounded-[24px] border border-dashed border-line bg-white px-6 py-9 text-center">
                <p className="text-lg font-bold text-brand">{vipUnavailable ? "VIP განცხადებები დროებით ვერ ჩაიტვირთა" : "მაღაზიების VIP განცხადებები მალე გამოჩნდება"}</p>
                <p className="mt-2 text-sm leading-6 text-text-soft">{vipUnavailable ? "სცადე მოგვიანებით." : "ამჟამად აქტიური VIP განცხადებები არ არის. დიზაინის სანახავად შეგიძლია დემოს გახსნა."}</p>
                {!vipUnavailable ? <Link href="/stores?demo=1" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-white">დემოს ნახვა ↗</Link> : null}
              </div>
            )}
          </section>

          <section id="discover-stores" className="scroll-mt-28 pt-11 sm:pt-16">
            <div className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#ad7558]">აღმოაჩინე / მაღაზიები</p>
                <h2 className="mt-2 text-3xl font-semibold tracking-tight text-brand sm:text-4xl">რჩეული მაღაზიები</h2>
                <p className="mt-3 text-sm leading-6 text-[#717a70]">აღმოაჩინე მაღაზია, დაათვალიერე ნივთები და დაუკავშირდი პირდაპირ.</p>
              </div>
              <Link href={demo ? "/stores" : "/stores?demo=1"} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-xs font-semibold hover:bg-[#eee6d9]">
                {demo ? "რეალური მაღაზიების ნახვა" : "დიზაინის დემო"} ↗
              </Link>
            </div>

            {demo ? (
              <p role="status" className="mt-6 border-l-[3px] border-[#bc8457] bg-[#efe5d9] p-4 text-sm leading-6 text-[#655445]">
                დიზაინის დემო — ქვემოთ მოცემული მაღაზიები, ფოტოები და აღწერები საჩვენებელია და არ წარმოადგენს SamoSell-ის რეალურ განცხადებებს.
              </p>
            ) : null}

            <form action="/stores" method="GET" className="mt-7 flex flex-col gap-3 rounded-2xl border border-line bg-white p-3 shadow-[0_10px_30px_rgba(7,63,59,0.05)] sm:flex-row">
              {demo ? <input type="hidden" name="demo" value="1" /> : null}
              <label htmlFor="store-search" className="sr-only">მაღაზიის მოძებნა</label>
              <input
                id="store-search" type="search" name="q" maxLength={80} defaultValue={q}
                placeholder="მოძებნე მაღაზია, სახელი ან ქალაქი..."
                className="min-h-12 min-w-0 flex-1 rounded-none border-b border-line bg-transparent px-3 text-sm text-[#293f37] outline-none focus:border-brand sm:border-b-0"
              />
              <button type="submit" className="min-h-12 rounded-xl bg-brand px-8 text-sm font-black text-white hover:bg-brand-hover">ძებნა ↗</button>
            </form>

            {temporarilyUnavailable ? (
              <p role="status" className="mt-8 border-l-[3px] border-[#c58a45] bg-[#fff2d9] p-6 text-sm text-[#745632]">
                მაღაზიების მონაცემები დროებით მიუწვდომელია. სცადე მოგვიანებით.
              </p>
            ) : null}

            {(demo ? shownDemo.length : shownStores.length) > 0 ? (
              <div className="mt-9 grid gap-x-7 gap-y-11 sm:grid-cols-2 lg:grid-cols-3">
                {demo ? shownDemo.map((store, index) => (
                  <Link key={store.name} href="/stores/showcase" className="group block min-w-0 overflow-hidden rounded-[26px] border border-line bg-white p-3 shadow-[0_10px_30px_rgba(7,63,59,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(7,63,59,0.09)]">
                    <div className="relative aspect-[4/4.7] overflow-hidden rounded-2xl" style={{ backgroundColor: store.backdrop }}>
                      <div className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105" style={{ backgroundImage: "url('" + store.photo + "')" }} />
                      <span className="absolute left-4 top-4 bg-[#f8f5ee]/95 px-3 py-2 text-[10px] font-bold uppercase tracking-widest">დემო · 0{index + 1}</span>
                    </div>
                    <div className="mt-4 flex items-start justify-between gap-3 px-2 pb-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b47b5d]">{store.kind}</p>
                        <h3 className="mt-1 truncate text-xl font-semibold text-brand">{store.name}</h3>
                        <p className="mt-2 text-xs text-[#777971]">{store.city} · {store.description}</p>
                      </div>
                      <span aria-hidden="true" className="text-2xl transition-transform group-hover:translate-x-1">↗</span>
                    </div>
                  </Link>
                )) : shownStores.map((store) => (
                  <Link key={store.id} href={"/seller/" + encodeURIComponent(store.username!)} className="group block min-w-0 overflow-hidden rounded-[26px] border border-line bg-white p-3 shadow-[0_10px_30px_rgba(7,63,59,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_rgba(7,63,59,0.09)]">
                    <div className="relative aspect-[4/4.7] overflow-hidden rounded-2xl bg-[#e4ddcf]">
                      {store.store_banner_url ? (
                        <SmartImage src={store.store_banner_url} alt={store.full_name || store.username || "მაღაზიის ფოტო"} wrapperClassName="h-full w-full" sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(140deg,#d7e4d9,#eee0d0)]">
                          {store.store_logo_url ? (
                            <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-white shadow-sm">
                              <SmartImage src={store.store_logo_url} alt={store.full_name || "მაღაზიის ლოგო"} wrapperClassName="h-full w-full" sizes="112px" />
                            </div>
                          ) : (
                            <span className="font-serif text-7xl text-[#6b8b79]">S</span>
                          )}
                        </div>
                      )}
                      <span className="absolute left-4 top-4 bg-[#f8f5ee]/95 px-3 py-2 text-[10px] font-bold uppercase tracking-wider">მაღაზია</span>
                    </div>
                    <div className="mt-4 flex items-start justify-between gap-3 px-2 pb-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b47b5d]">{store.city || "საქართველო"}</p>
                        <h3 className="mt-1 break-words text-xl font-semibold text-brand">{store.full_name || store.username}</h3>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#777971]">{store.bio || "აღმოაჩინე ამ მაღაზიის განცხადებები SamoSell-ზე"}</p>
                      </div>
                      <span aria-hidden="true" className="text-2xl transition-transform group-hover:translate-x-1">↗</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : !temporarilyUnavailable ? (
              <div className="mt-9 border border-dashed border-[#c9c0b1] bg-white/70 px-6 py-14 text-center">
                <p className="text-3xl font-normal text-[#ae795f]">ახალი ისტორია აქ იწყება.</p>
                <h3 className="mt-4 text-2xl font-semibold">{q ? "მაღაზია ვერ მოიძებნა" : "მაღაზიების კოლექცია მალე შეივსება"}</h3>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[#717a70]">
                  {q ? "სცადე სხვა საძიებო სიტყვა ან დაათვალიერე ყველა მაღაზია." : "პირველი პარტნიორი მაღაზიები მალე გამოჩნდება. თუ გაქვს მაღაზია, გახდი ერთ-ერთი პირველი."}
                </p>
                <Link href={q ? (demo ? "/stores?demo=1" : "/stores") : "/for-stores"} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-white">
                  {q ? "ყველა მაღაზია" : "გახსენი მაღაზია"} ↗
                </Link>
              </div>
            ) : null}
          </section>

          <section className="mt-16 grid gap-7 border-y border-line py-10 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#b47b5d]">შენი ახალი ისტორია აქ იწყება</p>
              <h2 className="mt-2 text-2xl font-semibold">შენი მაღაზიაც ამ სივრცეში.</h2>
              <p className="mt-2 text-sm leading-7 text-[#717a70]">დამატებითი ვიტრინა შენი ნივთებისთვის, ერთი გასაზიარებელი ბმულით.</p>
            </div>
            <Link href="/for-stores" className="inline-flex min-h-12 items-center justify-center rounded-full border border-brand px-7 text-sm font-semibold hover:bg-[#eee6d9]">გაიგე მეტი ↗</Link>
          </section>

          <div className="mt-7 flex flex-wrap justify-end gap-5 text-xs text-[#7a8075]">
            <Link href="/stores/concepts" className="underline underline-offset-4">დიზაინის სხვა ვარიანტები</Link>
          </div>
        </div>
      </main>
    </>
  )
}
