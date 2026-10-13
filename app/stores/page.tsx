import type { Metadata } from "next"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"
import SmartImage from "@/components/shared/SmartImage"
import { createPublicServerClient } from "@/lib/supabase/public-server"

type StoreProfile = {
  id: string
  username: string | null
  full_name: string | null
  bio: string | null
  city: string | null
  store_logo_url: string | null
  store_banner_url: string | null
  store_instagram: string | null
}

type StoreParams = { demo?: string; q?: string }

const sampleStores = [
  { name: "Studio Archive", city: "თბილისი", kind: "Vintage", initials: "SA", color: "bg-[#e8d8ca]", description: "გამორჩეული ვინტაჟური სამოსი და აქსესუარები" },
  { name: "Second Chapter", city: "თბილისი", kind: "Second-hand", initials: "SC", color: "bg-[#d3dfd6]", description: "მეორე სიცოცხლე შენს საყვარელ ნივთებს" },
  { name: "Sunday Edit", city: "ბათუმი", kind: "Curated fashion", initials: "SE", color: "bg-[#e7dbbd]", description: "შერჩეული სტილი ყოველდღიური გარდერობისთვის" },
]

export async function generateMetadata({ searchParams }: { searchParams?: Promise<StoreParams> }): Promise<Metadata> {
  const { demo } = (await searchParams) ?? {}
  return {
    title: "მაღაზიები — აღმოაჩინე შერჩეული მაღაზიები",
    description: "აღმოაჩინე დამოუკიდებელი მაღაზიები და მათი განცხადებები SamoSell-ზე.",
    alternates: { canonical: "/stores" },
    ...(demo === "1" ? { robots: { index: false, follow: false } } : {}),
  }
}

export default async function StoresPage({ searchParams }: { searchParams?: Promise<StoreParams> }) {
  const params = (await searchParams) ?? {}
  const demo = params.demo === "1"
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 80) : ""
  let stores: StoreProfile[] = []
  let temporarilyUnavailable = false

  if (!demo) {
    try {
      const supabase = createPublicServerClient()
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, full_name, bio, city, store_logo_url, store_banner_url, store_instagram")
        .eq("seller_type", "store")
        .eq("is_suspended", false)
        .order("created_at", { ascending: false })
        .limit(60)
      if (error) throw error
      stores = (data ?? []).filter((profile) => Boolean(profile.username)) as StoreProfile[]
    } catch (error) {
      temporarilyUnavailable = true
      console.warn("stores_directory_unavailable", error instanceof Error ? error.message : "unknown")
    }
  }

  const search = q.toLocaleLowerCase("ka")
  const shownStores = stores.filter((store) =>
    !search || [store.full_name, store.username, store.city, store.bio].some((part) => String(part ?? "").toLocaleLowerCase("ka").includes(search))
  )
  const shownSamples = sampleStores.filter((store) =>
    !search || [store.name, store.city, store.kind, store.description].some((part) => part.toLocaleLowerCase("ka").includes(search))
  )

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#faf9f6] text-[#073f3b]">
        <section className="relative overflow-hidden border-b border-[#e7ebe4] bg-[#f1f3ec]">
          <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-28 h-96 w-96 rounded-full bg-[#dfecdf] opacity-80 blur-3xl" />
          <div className="ui-container relative grid gap-10 py-12 sm:py-16 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] lg:items-center lg:py-20">
            <div>
              <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#ceded1] bg-white/80 px-4 py-2 text-xs font-bold tracking-wide text-[#075a53]">
                <span className="h-2 w-2 rounded-full bg-[#ef853f]" />
                SAMOSELL SHOPS
              </p>
              <h1 className="max-w-2xl text-4xl font-black leading-[1.12] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
                გამორჩეული ნივთები.
                <span className="block text-[#dc763a]">საკუთარი ისტორია.</span>
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-[#4c625b]">
                აღმოაჩინე პატარა ქართული მაღაზიები, ვინტაჟური კოლექციები და ახალი აღმოჩენები ერთ სივრცეში.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#discover-stores" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#075a53] px-6 text-sm font-bold text-white transition hover:bg-[#06453f]">
                  აღმოაჩინე მაღაზიები <span aria-hidden="true" className="ml-2">↗</span>
                </a>
                <Link href="/for-stores" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#aac4b6] bg-white px-6 text-sm font-bold text-[#075a53] transition hover:bg-[#e5f1ea]">
                  გაქვს მაღაზია?
                </Link>
              </div>
            </div>
            <div aria-hidden="true" className="relative hidden h-72 lg:block">
              <div className="absolute left-12 top-1 h-64 w-52 rotate-[-12deg] rounded-[2rem] border border-white bg-[#d7e4d9] shadow-xl" />
              <div className="absolute left-36 top-4 flex h-64 w-48 rotate-[8deg] flex-col justify-between rounded-[2rem] bg-[#f9ead9] p-7 shadow-xl">
                <span className="text-4xl">✳</span>
                <span className="text-4xl font-black leading-tight tracking-tight text-[#075a53]">Style<br />again.</span>
                <span className="text-sm font-semibold text-[#cc7747]">SHOP THE STORY ↗</span>
              </div>
              <div className="absolute bottom-0 left-4 flex h-28 w-28 items-center justify-center rounded-full border-8 border-[#f1f3ec] bg-[#eeab6b] text-5xl text-white shadow-lg">✦</div>
            </div>
          </div>
        </section>

        <section id="discover-stores" className="ui-container scroll-mt-28 py-10 sm:py-14">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#ce7442]">DISCOVER</p>
              <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">მაღაზიები</h2>
              <p className="mt-3 text-sm leading-7 text-[#687a71]">იპოვე მაღაზია, დაათვალიერე მისი ნივთები და დაუკავშირდი პირდაპირ.</p>
            </div>
            <Link href={demo ? "/stores" : "/stores?demo=1"} className="rounded-full border border-[#cbd9cf] px-4 py-2 text-xs font-bold text-[#075a53] transition hover:bg-white">
              {demo ? "რეალური მაღაზიების ნახვა" : "დიზაინის დემოს ნახვა"} ↗
            </Link>
          </div>

          {demo ? (
            <div role="status" className="mt-7 rounded-2xl border border-[#ecca9c] bg-[#fff6e6] px-5 py-4 text-sm leading-6 text-[#885b22]">
              დიზაინის დემო — ქვემოთ მოცემული მაღაზიები და აღწერები გამოგონილია. რეალური განცხადებები არ განთავსებულა.
            </div>
          ) : null}

          <form action="/stores" method="GET" className="mt-8 flex flex-col gap-3 rounded-[1.5rem] border border-[#e2e9e1] bg-white p-3 shadow-sm sm:flex-row">
            {demo ? <input type="hidden" name="demo" value="1" /> : null}
            <label htmlFor="store-search" className="sr-only">მაღაზიის მოძებნა</label>
            <input
              id="store-search"
              type="search"
              name="q"
              maxLength={80}
              defaultValue={q}
              placeholder="მოძებნე მაღაზია ან ქალაქი..."
              className="min-h-12 min-w-0 flex-1 rounded-xl border border-transparent bg-[#f7f8f5] px-5 text-sm text-[#073f3b] outline-none transition focus:border-[#075a53]"
            />
            <button type="submit" className="min-h-12 rounded-xl bg-[#075a53] px-7 text-sm font-bold text-white transition hover:bg-[#06453f]">ძებნა</button>
          </form>

          {temporarilyUnavailable ? (
            <p role="status" className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
              მაღაზიების სია დროებით ვერ ჩაიტვირთა. სცადე განახლება მოგვიანებით.
            </p>
          ) : null}

          {(demo ? shownSamples.length : shownStores.length) > 0 ? (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {demo ? shownSamples.map((store) => (
                <Link key={store.name} href="/stores/showcase" className="group overflow-hidden rounded-[1.7rem] border border-[#e5e8e2] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <div className={"relative flex h-48 items-center justify-center overflow-hidden " + store.color}>
                    <span className="select-none text-[5.5rem] font-black tracking-[-0.09em] text-[#073f3b]/20">{store.initials}</span>
                    <span className="absolute right-4 top-4 rounded-full bg-white/90 px-3 py-1.5 text-xs font-bold text-[#075a53]">დემო</span>
                    <span className="absolute bottom-4 left-5 rounded-full bg-[#073f3b] px-3 py-1.5 text-xs font-bold text-white">{store.kind}</span>
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-xl font-black">{store.name}</h3>
                      <span aria-hidden="true" className="text-xl text-[#de8246]">↗</span>
                    </div>
                    <p className="mt-2 text-sm text-[#64796f]">{store.description}</p>
                    <p className="mt-5 text-xs font-bold text-[#8a9a8f]">⌖ {store.city} · ნახე ვიტრინის დემო</p>
                  </div>
                </Link>
              )) : shownStores.map((store) => (
                <Link key={store.id} href={"/seller/" + encodeURIComponent(store.username!)} className="group overflow-hidden rounded-[1.7rem] border border-[#e5e8e2] bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <div className="relative h-48 bg-[#e2eae0]">
                    {store.store_banner_url ? (
                      <SmartImage src={store.store_banner_url} alt={store.full_name || store.username || "მაღაზია"} wrapperClassName="h-full w-full" className="object-cover" sizes="(max-width: 640px) 100vw, 33vw" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-6xl font-black text-[#075a53]/25">S</div>
                    )}
                    {store.store_logo_url ? (
                      <div className="absolute bottom-3 left-4 h-16 w-16 overflow-hidden rounded-2xl border-4 border-white bg-white shadow-md">
                        <SmartImage src={store.store_logo_url} alt="" wrapperClassName="h-full w-full" sizes="64px" />
                      </div>
                    ) : null}
                  </div>
                  <div className="p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="break-words text-xl font-black">{store.full_name || store.username}</h3>
                      <span aria-hidden="true" className="text-xl text-[#de8246]">↗</span>
                    </div>
                    <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-[#64796f]">{store.bio || "აღმოაჩინე ამ მაღაზიის განცხადებები SamoSell-ზე"}</p>
                    <p className="mt-5 text-xs font-bold text-[#8a9a8f]">{store.city || "საქართველო"} · განცხადებების ნახვა</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : !temporarilyUnavailable ? (
            <div className="mt-8 rounded-[1.7rem] border border-dashed border-[#bed3c5] bg-white px-6 py-14 text-center">
              <div className="text-4xl">✳</div>
              <h3 className="mt-4 text-xl font-black">{q ? "მაღაზია ვერ მოიძებნა" : "პირველი მაღაზიები მალე გამოჩნდება"}</h3>
              <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-[#687a71]">
                {q ? "შეცვალე საძიებო სიტყვა და სცადე თავიდან." : "თუ გაქვს მაღაზია, შეგიძლია ერთ-ერთი პირველი იყო SamoSell Shops-ში."}
              </p>
              <Link href={q ? (demo ? "/stores?demo=1" : "/stores") : "/for-stores"} className="mt-5 inline-flex rounded-full bg-[#075a53] px-6 py-3 text-sm font-bold text-white">
                {q ? "ყველა მაღაზიის ნახვა" : "მაღაზიის დამატება"}
              </Link>
            </div>
          ) : null}
        </section>

        <section className="border-t border-[#e4e9e1] bg-[#e8eee7]">
          <div className="ui-container flex flex-col gap-6 py-12 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-black tracking-[0.2em] text-[#c46e39]">FOR STORES</p>
              <h2 className="mt-2 text-2xl font-black">შენი მაღაზიაც აქ უნდა იყოს.</h2>
              <p className="mt-2 text-sm text-[#64796f]">შექმენი ვიტრინა, განათავსე ნივთები და იპოვე ახალი მყიდველები.</p>
            </div>
            <Link href="/for-stores" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[#075a53] px-7 text-sm font-bold text-white">გაიგე მეტი ↗</Link>
          </div>
        </section>
      </main>
    </>
  )
}
