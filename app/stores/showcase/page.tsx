import type { Metadata } from "next"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"

export const metadata: Metadata = {
  title: "მაღაზიის ვიტრინის დიზაინის დემო",
  description: "SamoSell Shops — მაღაზიის ვიტრინის ვიზუალური კონცეფცია",
  robots: { index: false, follow: false },
}

const products = [
  { name: "კლასიკური ჟაკეტი", price: "85 ₾", color: "bg-[#decaba]", icon: "✦", condition: "ვინტაჟი" },
  { name: "მინიმალისტური ჩანთა", price: "70 ₾", color: "bg-[#c7d4c8]", icon: "◈", condition: "კარგი მდგომარეობა" },
  { name: "დენიმის ქურთუკი", price: "110 ₾", color: "bg-[#b9cbd9]", icon: "✳", condition: "როგორც ახალი" },
  { name: "რეტრო სათვალე", price: "45 ₾", color: "bg-[#ead7b0]", icon: "◉", condition: "ვინტაჟი" },
  { name: "ტრენჩი", price: "140 ₾", color: "bg-[#d9dbcb]", icon: "☆", condition: "კარგი მდგომარეობა" },
  { name: "ტყავის ქამარი", price: "35 ₾", color: "bg-[#e3c7bc]", icon: "❖", condition: "როგორც ახალი" },
]

export default function StoreShowcasePage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#faf9f6] text-[#073f3b]">
        <div className="ui-container pb-16 pt-6 sm:pt-10">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Link href="/stores?demo=1" className="text-sm font-bold text-[#658076] transition hover:text-[#075a53]">← მაღაზიების დემო</Link>
            <span className="rounded-full border border-[#ecc78a] bg-[#fff4df] px-4 py-2 text-xs font-bold text-[#865c2b]">დიზაინის დემო — გამოგონილი მაღაზია და ნივთები</span>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-[#e6e7df] bg-white shadow-sm">
            <div className="relative flex h-48 items-center justify-center overflow-hidden bg-[#d9e5db] sm:h-64">
              <div aria-hidden="true" className="absolute -left-14 -top-24 h-80 w-80 rounded-full bg-[#b6d4c0] opacity-80" />
              <div aria-hidden="true" className="absolute -right-16 -bottom-48 h-[24rem] w-[24rem] rounded-full bg-[#e7bd9a] opacity-70" />
              <div className="relative text-center">
                <p className="text-xs font-bold tracking-[0.45em] text-[#3c7163]">CURATED VINTAGE</p>
                <p className="mt-4 text-5xl font-black tracking-[-0.05em] text-[#075a53] sm:text-7xl">STUDIO ARCHIVE</p>
                <p className="mt-2 text-xs font-semibold tracking-[0.25em] text-[#3c7163]">SECOND STORIES, NEW STYLE</p>
              </div>
            </div>
            <div className="p-5 sm:p-8">
              <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-[#075a53] text-2xl font-black text-white shadow-md">SA</div>
                  <div>
                    <p className="text-xs font-bold tracking-[0.17em] text-[#ba774f]">VINTAGE STORE · DEMO</p>
                    <h1 className="mt-1 text-2xl font-black sm:text-3xl">Studio Archive</h1>
                    <p className="mt-1 text-sm text-[#70827a]">თბილისი · შერჩეული ვინტაჟი</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="inline-flex min-h-11 items-center justify-center rounded-full bg-[#075a53] px-6 text-sm font-bold text-white">მაღაზიასთან მიწერა</div>
                  <div className="inline-flex min-h-11 items-center justify-center rounded-full border border-[#b7cdbf] px-6 text-sm font-bold">გამოწერა</div>
                </div>
              </div>
              <p className="mt-6 max-w-3xl text-sm leading-7 text-[#60776e]">
                ძველი ეპოქის ნივთები ახალი ისტორიებისთვის. ხელით შერჩეული ვინტაჟური ჟაკეტები, ჩანთები და ყოველდღიური სტილის გამორჩეული დეტალები.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-4 border-t border-[#ebede7] pt-6 text-sm">
                <span className="font-semibold"><strong className="text-xl">6</strong> საჩვენებელი ნივთი</span>
                <span className="text-[#95a89a]">·</span>
                <span className="font-semibold">⌖ თბილისი</span>
                <span className="text-[#95a89a]">·</span>
                <span className="text-[#62786e]">საკონტაქტო ბმულები რეალურ გვერდზე</span>
              </div>
            </div>
          </div>

          <div className="mt-12 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-[#c47849]">THE EDIT</p>
              <h2 className="mt-2 text-3xl font-black">მაღაზიის განცხადებები</h2>
              <p className="mt-2 text-sm text-[#687c70]">საჩვენებელი ნივთები რეალური ფოტოებისა და ფასების გარეშე</p>
            </div>
            <span className="rounded-full border border-[#c8d8cc] px-4 py-2 text-xs font-bold">ყველა · 6</span>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-3 xl:gap-6">
            {products.map((product) => (
              <article key={product.name} className="overflow-hidden rounded-[1.4rem] border border-[#e3e8e0] bg-white shadow-sm">
                <div className={"relative flex aspect-[4/5] items-center justify-center " + product.color}>
                  <span aria-hidden="true" className="select-none text-7xl text-[#075a53]/30 sm:text-8xl">{product.icon}</span>
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1.5 text-[10px] font-black text-[#075a53]">დემო</span>
                </div>
                <div className="p-4 sm:p-5">
                  <p className="text-xs text-[#899c8e]">{product.condition}</p>
                  <h3 className="mt-1 line-clamp-2 text-sm font-bold sm:text-base">{product.name}</h3>
                  <p className="mt-3 text-lg font-black text-[#075a53]">{product.price}</p>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-12 rounded-[1.6rem] bg-[#eaf0e9] p-6 sm:p-9">
            <h2 className="text-2xl font-black">ასე შეიძლება გამოიყურებოდეს შენი მაღაზიაც.</h2>
            <p className="mt-2 text-sm text-[#65786e]">საჩვენებელი დიზაინია. რეალური მაღაზიის გვერდი არსებული პროფილისა და განცხადებების მონაცემებით შეივსება.</p>
            <Link href="/for-stores" className="mt-5 inline-flex rounded-full bg-[#075a53] px-6 py-3 text-sm font-bold text-white">ჩემი მაღაზიის შექმნა ↗</Link>
          </div>
        </div>
      </main>
    </>
  )
}
