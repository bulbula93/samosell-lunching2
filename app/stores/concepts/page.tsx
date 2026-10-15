import type { Metadata } from "next"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"

export const metadata: Metadata = {
  title: "SamoSell Shops — დიზაინის 3 კონცეფცია",
  description: "SamoSell Shops-ის მაღაზიების კატალოგის სამი საცდელი ვიზუალური მიმართულება",
  robots: { index: false, follow: false },
}

type Concept = "editorial" | "bold" | "gallery"
type ConceptPageParams = { style?: string | string[] }
const concepts: { slug: Concept; name: string; subtitle: string }[] = [
  { slug: "editorial", name: "01 · ჟურნალის სტილი", subtitle: "ელეგანტური / მოდის ჟურნალი" },
  { slug: "bold", name: "02 · მკვეთრი", subtitle: "მკვეთრი / ახალგაზრდული" },
  { slug: "gallery", name: "03 · გალერეა", subtitle: "მინიმალისტური / სუფთა" },
]

// Concept-only imagery from Unsplash, never actual SamoSell store photos.
// Demo stores, names, locations, catalog totals and products are invented.
const photography = {
  boutique: "https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=75",
  wardrobe: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=75",
  street: "https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1200&q=75",
  portrait: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=1200&q=75",
}

const sample = [
  { name: "სტუდიო არქივი", city: "თბილისი", category: "რჩეული ვინტაჟი", amount: "24 ნივთი", initials: "SA", photo: photography.boutique, color: "#dfd0bf" },
  { name: "მეორე თავი", city: "თბილისი", category: "მეორადი", amount: "18 ნივთი", initials: "SC", photo: photography.wardrobe, color: "#d7e4d9" },
  { name: "კვირის რჩეული", city: "ბათუმი", category: "მეორედ აღმოჩენილი სტილი", amount: "32 ნივთი", initials: "SE", photo: photography.street, color: "#ead4bd" },
]

function Cover({ image, className = "", position = "center" }: { image: string; className?: string; position?: string }) {
  return (
    <div
      aria-hidden="true"
      className={"bg-[#d9ddd4] bg-cover bg-center " + className}
      style={{ backgroundImage: "url('" + image + "')", backgroundPosition: position }}
    />
  )
}

function EditorialConcept() {
  return (
    <section aria-label="Editorial design" className="bg-[#f8f5ee] text-[#2c322e]">
      <div className="ui-container pt-8 pb-16 sm:pt-12">
        <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#c6c1b5] py-4 text-[11px] font-semibold uppercase tracking-[0.17em]">
          <span>SamoSell-ის რჩეული</span>
          <span>მეორედ აღმოჩენილი / თავიდან შეყვარებული</span>
          <span>საქართველო · 2026</span>
        </div>
        <div className="grid gap-8 pt-8 lg:grid-cols-[1fr_0.95fr] lg:gap-14">
          <div className="flex flex-col justify-center">
            <p className="text-xs font-semibold tracking-[0.09em] text-[#aa684f]">ადგილობრივი სტილის ჟურნალი</p>
            <h1 className="mt-6 max-w-xl font-serif text-[clamp(3.9rem,8vw,7.9rem)] leading-[0.93] tracking-[-0.055em]">
              შენი <span className="italic text-[#ae795f]">ახალი</span><br/> აღმოჩენა.
            </h1>
            <p className="mt-8 max-w-md text-base leading-8 text-[#676f65]">გამორჩეული მაღაზიები, ხელით შერჩეული ნივთები და ისტორიები, რომლებიც შენს სტილს შეეფერება.</p>
            <div className="mt-9 flex flex-wrap gap-3">
              <a href="#editorial-stores" className="inline-flex min-h-12 items-center rounded-full bg-[#293f37] px-7 text-sm font-semibold text-white">აღმოაჩინე მაღაზიები ↗</a>
              <Link href="/for-stores" className="inline-flex min-h-12 items-center rounded-full border border-[#bcb5a8] px-7 text-sm font-semibold">შექმენი მაღაზია</Link>
            </div>
            <div className="mt-12 flex gap-8 border-t border-[#cfc9bc] pt-5 text-xs uppercase tracking-[0.15em] text-[#827c70]">
              <span>ვინტაჟი</span><span>მეორადი</span><span>დიზაინერები</span>
            </div>
          </div>
          <div className="relative mx-auto min-h-[420px] w-full max-w-xl sm:min-h-[530px]">
            <Cover image={photography.portrait} className="absolute inset-0 bottom-10 left-[9%] right-5 rounded-t-[8rem] rounded-b-xl" position="center 35%" />
            <div className="absolute bottom-0 left-0 max-w-[75%] bg-[#efe3d4] p-6 shadow-xl sm:p-8">
              <p className="font-serif text-xl italic leading-snug sm:text-2xl">იპოვე შენი შემდეგი რჩეული.</p>
              <p className="mt-2 text-xs tracking-[0.08em] text-[#827469]">მეორადი, მაგრამ მუდამ საყვარელი</p>
            </div>
            <div className="absolute right-1 top-7 rounded-full border border-[#f6f0e8] bg-[#293f37] px-4 py-2 text-[10px] font-bold tracking-[0.14em] text-white">რჩეული · 01</div>
          </div>
        </div>
        <div id="editorial-stores" className="mt-20 scroll-mt-28">
          <div className="flex items-end justify-between gap-5 border-b border-[#c6c1b5] pb-5">
            <div>
              <p className="text-[11px] uppercase tracking-[0.22em] text-[#ad7558]">აღმოაჩინე / მაღაზიები</p>
              <h2 className="mt-2 font-serif text-4xl tracking-tight sm:text-5xl">რჩეული მაღაზიები</h2>
            </div>
            <span className="hidden text-xs tracking-[0.05em] text-[#898275] sm:block">03 საჩვენებელი მაღაზია</span>
          </div>
          <div className="mt-7 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {sample.map((store, i) => (
              <Link href="/stores/showcase" key={store.name} className="group block">
                <div className="relative aspect-[4/4.7] overflow-hidden bg-[#dfd3c5]">
                  <Cover image={store.photo} className="h-full w-full transition-transform duration-500 group-hover:scale-105"/>
                  <span className="absolute left-4 top-4 bg-[#f8f5ee]/95 px-3 py-1.5 text-[10px] font-bold tracking-widest">დემო · 0{i + 1}</span>
                </div>
                <div className="mt-5 flex items-start justify-between gap-2">
                  <div><p className="text-[10px] uppercase tracking-[0.18em] text-[#b47b5d]">{store.category}</p><h3 className="mt-1 font-serif text-2xl">{store.name}</h3><p className="mt-2 text-xs text-[#777971]">{store.city} · {store.amount}</p></div>
                  <span aria-hidden="true" className="text-2xl">↗</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function BoldConcept() {
  return (
    <section aria-label="Bold design" className="overflow-hidden bg-[#083e38] text-[#fbf7e9]">
      <div className="ui-container pt-8 pb-16 sm:pt-12">
        <div className="flex items-center justify-between gap-4 rounded-full border border-[#adce8b] px-5 py-3 text-xs font-black tracking-wider">
          <span>SamoSell / მაღაზიები</span><span className="rounded-full bg-[#d4f071] px-4 py-1 text-[#103c36]">აღმოაჩინე ქართული მაღაზიები ↗</span>
        </div>
        <div className="relative mt-10 grid min-h-[450px] gap-8 lg:grid-cols-[1.18fr_0.82fr] lg:items-center">
          <div className="relative z-10 py-6">
            <p className="mb-4 inline-flex rotate-[-3deg] bg-[#ff8146] px-4 py-2 text-xs font-black tracking-widest text-[#103c36]">შენი შემდეგი რჩეული ადგილი</p>
            <h1 className="text-[clamp(4rem,10vw,9rem)] font-black uppercase leading-[0.9] tracking-[-0.09em]">
              იპოვე<br/><span className="text-[#d4f071]">შენი</span><br/>სტილი<span className="text-[#ff8751]">.</span>
            </h1>
            <p className="mt-8 max-w-lg text-base leading-7 text-[#c4d7c8]">ქართული მაღაზიები, გამორჩეული ნივთები და მეორედ აღმოჩენილი სტილი. ყველაფერი ერთ სივრცეში.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#bold-stores" className="inline-flex min-h-12 items-center rounded-full bg-[#d4f071] px-7 text-sm font-black text-[#083e38]">ნახე მაღაზიები ↗</a>
              <Link href="/for-stores" className="inline-flex min-h-12 items-center rounded-full border border-[#d4f071] px-7 text-sm font-black text-[#d4f071]">დაამატე შენი</Link>
            </div>
          </div>
          <div className="relative mx-auto h-96 w-full max-w-sm lg:h-[490px]">
            <div className="absolute inset-x-10 inset-y-4 rotate-[8deg] rounded-[2.5rem] bg-[#ff854b]" />
            <Cover image={photography.street} className="absolute inset-x-7 inset-y-6 -rotate-[7deg] rounded-[2rem] border-[10px] border-[#fcf5e9] shadow-2xl" position="center 30%"/>
            <span className="absolute -left-1 top-9 rotate-[-12deg] rounded-xl bg-[#d4f071] px-5 py-3 text-lg font-black text-[#083e38]">100% სტილი</span>
            <span className="absolute -right-2 bottom-4 rotate-[10deg] rounded-full bg-[#ff854b] px-6 py-4 text-base font-black text-[#083e38]">✳ ჩაიცვი ხელახლა</span>
          </div>
        </div>
      </div>
      <div className="-rotate-1 border-y-2 border-[#083e38] bg-[#d4f071] py-3 text-center text-sm font-black tracking-[0.12em] text-[#083e38] sm:text-xl">
        აღმოაჩინე ✳ შეიყვარე ✳ ჩაიცვი ხელახლა ✳ აღმოაჩინე ✳
      </div>
      <div id="bold-stores" className="ui-container scroll-mt-28 py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-black tracking-[0.2em] text-[#d4f071]">ქართული აღმოჩენები ↓</p><h2 className="mt-3 text-4xl font-black uppercase tracking-[-0.06em] sm:text-6xl">აირჩიე მაღაზია<span className="text-[#ff8751]">.</span></h2></div>
          <span className="rounded-full border border-[#9eb9ac] px-4 py-2 text-xs font-black">03 საჩვენებელი მაღაზია</span>
        </div>
        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {sample.map((store, i) => (
            <Link href="/stores/showcase" key={store.name} className="group overflow-hidden rounded-[1.5rem] border-2 border-[#e4f3c8] bg-[#fcf7ec] text-[#073f3b] transition-transform hover:-translate-y-1">
              <div className="relative aspect-[5/4] overflow-hidden" style={{backgroundColor:store.color}}>
                <Cover image={store.photo} className="h-full w-full transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute left-4 top-4 rounded-full bg-[#d4f071] px-3 py-1 text-[10px] font-black">დემო 0{i+1}</div>
              </div>
              <div className="p-6">
                <span className="rounded-full bg-[#e8efe3] px-3 py-1 text-[10px] font-black tracking-wide">{store.category}</span>
                <h3 className="mt-5 text-3xl font-black uppercase leading-tight tracking-[-0.06em]">{store.name}</h3>
                <div className="mt-5 flex justify-between border-t border-[#cadbce] pt-4 text-xs font-bold"><span>{store.city} · {store.amount}</span><span>აღმოაჩინე ↗</span></div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function GalleryConcept() {
  return (
    <section aria-label="Gallery design" className="bg-white text-[#222524]">
      <div className="ui-container py-9 sm:py-14">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#292d2a] pb-5">
          <span className="text-lg font-black uppercase tracking-[-0.03em]">SamoSell / მაღაზიები</span>
          <span className="text-[11px] uppercase tracking-[0.22em] text-[#777e79]">დამოუკიდებელი მაღაზიები · საქართველო</span>
        </div>
        <div className="grid gap-8 py-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-20 lg:py-20">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#818781]">აღმოაჩინე მაღაზიები</p>
            <h1 className="mt-7 max-w-2xl text-[clamp(3.8rem,7.4vw,7rem)] font-semibold leading-[1.03] tracking-[-0.075em]">შერჩეული<br/>მაღაზიები<span className="text-[#b7c4b9]">.</span></h1>
          </div>
          <div className="pb-2">
            <p className="max-w-sm text-lg leading-8 text-[#626b65]">აღმოაჩინე ქართული მაღაზიები. ერთი ადგილი სხვადასხვა სტილისა და გამორჩეული ნივთებისთვის.</p>
            <div className="mt-8 flex flex-wrap items-center gap-6 text-sm font-semibold">
              <a href="#gallery-stores" className="border-b border-[#222524] pb-2">მაღაზიების ნახვა ↗</a>
              <Link href="/for-stores" className="border-b border-[#a6afa9] pb-2 text-[#616d64]">შექმენი მაღაზია ↗</Link>
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[1.5fr_0.5fr]">
          <Cover image={photography.boutique} className="h-[290px] sm:h-[420px]" position="center 60%" />
          <div className="flex flex-col justify-between border border-[#dce0dc] bg-[#f3f5f1] p-8">
            <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">ქართული რჩეული</span>
            <span className="text-7xl font-light text-[#818f84]">↗</span>
            <p className="max-w-xs text-sm leading-7 text-[#626c66]">Vintage, second-hand და დამოუკიდებელი მაღაზიების ახალი სივრცე.</p>
          </div>
        </div>
        <div id="gallery-stores" className="mt-16 scroll-mt-28">
          <div className="flex items-end justify-between gap-4 border-b border-[#222524] pb-5">
            <h2 className="text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">მაღაზიების სია</h2>
            <span className="text-xs text-[#7d847e]">03 / დემო</span>
          </div>
          <div className="divide-y divide-[#dde1da]">
            {sample.map((store, i) => (
              <Link href="/stores/showcase" key={store.name} className="group grid items-center gap-4 py-6 transition-colors hover:bg-[#fafbf8] sm:grid-cols-[2rem_7rem_1fr_1.2fr_2rem] sm:gap-6">
                <span className="hidden text-xs text-[#8d968c] sm:block">0{i+1}</span>
                <Cover image={store.photo} className="aspect-[4/3] w-full sm:aspect-square"/>
                <div><h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{store.name}</h3><p className="mt-2 text-xs text-[#8a918a]">დემო · {store.city}</p></div>
                <div className="text-xs font-medium uppercase tracking-[0.1em] text-[#6a756b]">{store.category}<span className="ml-4 normal-case tracking-normal">{store.amount}</span></div>
                <span className="hidden text-2xl transition-transform group-hover:translate-x-1 sm:block">↗</span>
              </Link>
            ))}
          </div>
          <Link href="/for-stores" className="mt-12 inline-flex min-h-12 items-center justify-center border border-[#292d2a] px-7 text-sm font-semibold transition hover:bg-[#f2f4f0]">შენი მაღაზიის დამატება ↗</Link>
        </div>
      </div>
    </section>
  )
}

export default async function ConceptsPage({ searchParams }: { searchParams?: Promise<ConceptPageParams> }) {
  const params = (await searchParams) ?? {}
  const style = typeof params.style === "string" ? params.style : ""
  const current: Concept = concepts.some((c) => c.slug === style) ? (style as Concept) : "editorial"

  return (
    <>
      <SiteHeader />
      <main>
        <div className="border-b border-[#c9d8d0] bg-[#f0f5ef] text-[#073f3b]">
          <div className="ui-container py-6 sm:py-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-[#9e6b3d]">დიზაინის შედარება · მხოლოდ სანახავად</p>
                <h2 className="mt-1 text-xl font-black sm:text-2xl">SamoSell Shops — 3 დიზაინის ვარიანტი</h2>
                <p className="mt-2 max-w-2xl text-xs leading-6 text-[#5e7367]">ყველა სახელი, რაოდენობა და ფოტო საჩვენებელია. დიზაინი არ არის რეალური მაღაზიის პროფილი. აირჩიე ვარიანტი და შეადარე.</p>
              </div>
              <Link href="/stores?demo=1" className="rounded-full border border-[#9abaaa] bg-white px-4 py-2 text-xs font-bold text-[#075a53]">← ძველი დიზაინი</Link>
            </div>
            <nav aria-label="დიზაინის ვარიანტები" className="mt-6 grid gap-2 sm:grid-cols-3">
              {concepts.map((c) => (
                <Link
                  key={c.slug}
                  href={"/stores/concepts?style=" + c.slug}
                  aria-current={current === c.slug ? "page" : undefined}
                  className={"flex min-h-16 flex-col justify-center rounded-xl border px-4 py-3 transition " + (current === c.slug ? "border-[#075a53] bg-[#075a53] text-white shadow-md" : "border-[#c3d5c9] bg-white text-[#075a53] hover:border-[#075a53]")}
                >
                  <span className="text-sm font-black">{c.name}</span>
                  <span className={"mt-1 text-xs " + (current === c.slug ? "text-[#dcefe7]" : "text-[#607e70]")}>{c.subtitle}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
        {current === "editorial" ? <EditorialConcept /> : current === "bold" ? <BoldConcept /> : <GalleryConcept />}
        <div className="bg-[#e9f0e8] text-[#073f3b]">
          <div className="ui-container flex flex-col gap-4 py-10 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-xl font-black">რომელი ვარიანტი ჯდება SamoSell-ში?</h2><p className="mt-2 text-sm text-[#607b6d]">ვიზუალების დამტკიცების შემდეგ რეალურ მაღაზიებსა და განცხადებებთან დავაკავშირებთ.</p></div>
            <Link href="/stores?demo=1" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#94b09e] bg-white px-6 text-sm font-bold">შეადარე პირველ ვერსიას ↗</Link>
          </div>
        </div>
      </main>
    </>
  )
}
