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
}

type StoreParams = { demo?: string | string[]; q?: string | string[] }

const demoStores = [
  { name: "Studio Archive", city: "თბილისი", kind: "CURATED VINTAGE", description: "გამორჩეული ვინტაჟური სამოსი და აქსესუარები", photo: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=75", initials: "SA", backdrop: "#ddd2c2" },
  { name: "Second Chapter", city: "თბილისი", kind: "SECOND-HAND", description: "მეორე სიცოცხლე შენს საყვარელ ნივთებს", photo: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1000&q=75", initials: "SC", backdrop: "#d7e4d9" },
  { name: "Sunday Edit", city: "ბათუმი", kind: "PRE-LOVED STYLE", description: "შერჩეული სტილი ყოველდღიური გარდერობისთვის", photo: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1000&q=75", initials: "SE", backdrop: "#e8d5bc" },
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
  let temporarilyUnavailable = false

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

  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#f8f5ee] text-[#28362e]">
        <div className="ui-container pt-7 pb-14 sm:pt-11 sm:pb-20">
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#c6c1b5] py-4 text-[10px] font-semibold uppercase tracking-[0.17em] sm:text-[11px]">
            <span>THE SAMOSELL EDIT</span>
            <span className="hidden sm:block">PRE-LOVED / RE-IMAGINED</span>
            <span>GEORGIA · SHOPS</span>
          </div>

          <section className="grid gap-9 py-9 lg:grid-cols-[1fr_0.95fr] lg:items-center lg:gap-14 lg:py-12">
            <div className="flex flex-col justify-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[#aa684f]">THE LOCAL WARDROBE JOURNAL</p>
              <h1 className="mt-6 font-serif text-[clamp(3.7rem,8vw,7.9rem)] leading-[0.96] tracking-[-0.055em]">
                შენი <span className="italic text-[#ae795f]">ახალი</span>
                <span className="block">აღმოჩენა.</span>
              </h1>
              <p className="mt-7 max-w-md text-base leading-8 text-[#677068]">
                ქართული მაღაზიები, გამორჩეული კოლექციები და ნივთები, რომლებსაც ახალი ისტორიის დაწყება შეუძლიათ.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <a href="#discover-stores" className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#293f37] px-7 text-sm font-semibold text-white transition hover:bg-[#375747]">
                  აღმოაჩინე მაღაზიები ↗
                </a>
                <Link href="/for-stores" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#bcb5a8] px-7 text-sm font-semibold transition hover:bg-[#eee6d9]">
                  გახსენი მაღაზია
                </Link>
              </div>
              <div className="mt-11 flex flex-wrap gap-x-8 gap-y-2 border-t border-[#cfc9bc] pt-5 text-[11px] uppercase tracking-[0.15em] text-[#817e75]">
                <span>Vintage</span><span>Second-hand</span><span>Independent stores</span>
              </div>
            </div>

            <div className="relative mx-auto h-[390px] w-full max-w-xl sm:h-[530px]">
              <div
                role="img"
                aria-label="საჩვენებელი მოდის ფოტო, რომელიც SamoSell-ის მაღაზიებს არ ეკუთვნის"
                className="absolute inset-x-5 top-0 bottom-12 rounded-t-[8rem] rounded-b-xl bg-[#e1d7ca] bg-cover bg-center sm:left-[9%]"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1100&q=75')" }}
              />
              <div className="absolute bottom-0 left-0 max-w-[78%] bg-[#efe3d4] p-5 shadow-lg sm:p-8">
                <p className="font-serif text-2xl italic sm:text-3xl">Find your next favourite.</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.17em] text-[#827469]">PRE-LOVED, ALWAYS LOVED</p>
              </div>
              <div className="absolute right-1 top-7 rounded-full border border-[#f6f0e8] bg-[#293f37] px-4 py-2 text-[10px] font-bold tracking-[0.14em] text-white">THE EDIT · SHOPS</div>
            </div>
          </section>

          <section id="discover-stores" className="scroll-mt-28 pt-11 sm:pt-16">
            <div className="flex flex-wrap items-end justify-between gap-5 border-b border-[#c6c1b5] pb-5">
              <div>
                <p className="text-[11px] uppercase tracking-[0.22em] text-[#ad7558]">DISCOVER / SHOPS</p>
                <h2 className="mt-2 font-serif text-4xl tracking-tight sm:text-5xl">რჩეული მაღაზიები</h2>
                <p className="mt-3 text-sm leading-6 text-[#717a70]">აღმოაჩინე მაღაზია, დაათვალიერე ნივთები და დაუკავშირდი პირდაპირ.</p>
              </div>
              <Link href={demo ? "/stores" : "/stores?demo=1"} className="inline-flex min-h-11 items-center rounded-full border border-[#bcb5a8] px-4 text-xs font-semibold hover:bg-[#eee6d9]">
                {demo ? "რეალური მაღაზიების ნახვა" : "დიზაინის დემო"} ↗
              </Link>
            </div>

            {demo ? (
              <p role="status" className="mt-6 border-l-[3px] border-[#bc8457] bg-[#efe5d9] p-4 text-sm leading-6 text-[#655445]">
                დიზაინის დემო — ქვემოთ მოცემული მაღაზიები, ფოტოები და აღწერები საჩვენებელია და არ წარმოადგენს SamoSell-ის რეალურ განცხადებებს.
              </p>
            ) : null}

            <form action="/stores" method="GET" className="mt-7 flex flex-col gap-3 border-b border-[#c6c1b5] pb-5 sm:flex-row">
              {demo ? <input type="hidden" name="demo" value="1" /> : null}
              <label htmlFor="store-search" className="sr-only">მაღაზიის მოძებნა</label>
              <input
                id="store-search" type="search" name="q" maxLength={80} defaultValue={q}
                placeholder="მოძებნე მაღაზია, სახელი ან ქალაქი..."
                className="min-h-12 min-w-0 flex-1 rounded-none border-b border-[#bcb5a8] bg-transparent px-3 text-sm text-[#293f37] outline-none focus:border-[#293f37] sm:border-b-0"
              />
              <button type="submit" className="min-h-12 rounded-full bg-[#293f37] px-8 text-sm font-semibold text-white hover:bg-[#375747]">ძებნა ↗</button>
            </form>

            {temporarilyUnavailable ? (
              <p role="status" className="mt-8 border-l-[3px] border-[#c58a45] bg-[#fff2d9] p-6 text-sm text-[#745632]">
                მაღაზიების მონაცემები დროებით მიუწვდომელია. სცადე მოგვიანებით.
              </p>
            ) : null}

            {(demo ? shownDemo.length : shownStores.length) > 0 ? (
              <div className="mt-9 grid gap-x-7 gap-y-11 sm:grid-cols-2 lg:grid-cols-3">
                {demo ? shownDemo.map((store, index) => (
                  <Link key={store.name} href="/stores/showcase" className="group block min-w-0">
                    <div className="relative aspect-[4/4.7] overflow-hidden" style={{ backgroundColor: store.backdrop }}>
                      <div className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105" style={{ backgroundImage: "url('" + store.photo + "')" }} />
                      <span className="absolute left-4 top-4 bg-[#f8f5ee]/95 px-3 py-2 text-[10px] font-bold uppercase tracking-widest">DEMO · 0{index + 1}</span>
                    </div>
                    <div className="mt-5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b47b5d]">{store.kind}</p>
                        <h3 className="mt-1 truncate font-serif text-2xl">{store.name}</h3>
                        <p className="mt-2 text-xs text-[#777971]">{store.city} · {store.description}</p>
                      </div>
                      <span aria-hidden="true" className="text-2xl transition-transform group-hover:translate-x-1">↗</span>
                    </div>
                  </Link>
                )) : shownStores.map((store) => (
                  <Link key={store.id} href={"/seller/" + encodeURIComponent(store.username!)} className="group block min-w-0">
                    <div className="relative aspect-[4/4.7] overflow-hidden bg-[#e4ddcf]">
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
                    <div className="mt-5 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#b47b5d]">{store.city || "საქართველო"}</p>
                        <h3 className="mt-1 break-words font-serif text-2xl">{store.full_name || store.username}</h3>
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#777971]">{store.bio || "აღმოაჩინე ამ მაღაზიის განცხადებები SamoSell-ზე"}</p>
                      </div>
                      <span aria-hidden="true" className="text-2xl transition-transform group-hover:translate-x-1">↗</span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : !temporarilyUnavailable ? (
              <div className="mt-9 border border-dashed border-[#c9c0b1] bg-white/70 px-6 py-14 text-center">
                <p className="font-serif text-4xl italic text-[#ae795f]">A new story begins here.</p>
                <h3 className="mt-4 font-serif text-2xl">{q ? "მაღაზია ვერ მოიძებნა" : "მაღაზიების კოლექცია მალე შეივსება"}</h3>
                <p className="mx-auto mt-3 max-w-lg text-sm leading-7 text-[#717a70]">
                  {q ? "სცადე სხვა საძიებო სიტყვა ან დაათვალიერე ყველა მაღაზია." : "პირველი პარტნიორი მაღაზიები მალე გამოჩნდება. თუ გაქვს მაღაზია, გახდი ერთ-ერთი პირველი."}
                </p>
                <Link href={q ? (demo ? "/stores?demo=1" : "/stores") : "/for-stores"} className="mt-6 inline-flex min-h-12 items-center justify-center rounded-full bg-[#293f37] px-7 text-sm font-semibold text-white">
                  {q ? "ყველა მაღაზია" : "გახსენი მაღაზია"} ↗
                </Link>
              </div>
            ) : null}
          </section>

          <section className="mt-16 grid gap-7 border-y border-[#c6c1b5] py-10 sm:grid-cols-[1fr_auto] sm:items-center">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-[#b47b5d]">YOUR STORY STARTS HERE</p>
              <h2 className="mt-2 font-serif text-3xl">შენი მაღაზიაც ამ სივრცეში.</h2>
              <p className="mt-2 text-sm leading-7 text-[#717a70]">დამატებითი ვიტრინა შენი ნივთებისთვის, ერთი გასაზიარებელი ბმულით.</p>
            </div>
            <Link href="/for-stores" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#293f37] px-7 text-sm font-semibold hover:bg-[#eee6d9]">გაიგე მეტი ↗</Link>
          </section>

          <div className="mt-7 flex flex-wrap justify-end gap-5 text-xs text-[#7a8075]">
            <Link href="/stores/concepts" className="underline underline-offset-4">დიზაინის სხვა ვარიანტები</Link>
          </div>
        </div>
      </main>
    </>
  )
}
