import type { Metadata } from "next"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"

export const metadata: Metadata = {
  title: "Editorial ვიტრინა — SamoSell Shops დემო",
  description: "SamoSell Shops-ის Editorial მაღაზიის ვიტრინის ვიზუალური დემო",
  robots: { index: false, follow: false },
}

const products = [
  { name: "კლასიკური ჟაკეტი", price: "85 ₾", condition: "ვინტაჟი", color: "#d6bead", photo: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=800&q=75" },
  { name: "მინიმალისტური ჩანთა", price: "70 ₾", condition: "კარგი მდგომარეობა", color: "#d8dfd3", photo: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=75" },
  { name: "დენიმის ქურთუკი", price: "110 ₾", condition: "როგორც ახალი", color: "#c5d2d7", photo: "https://images.unsplash.com/photo-1543076447-215ad9ba6923?auto=format&fit=crop&w=800&q=75" },
  { name: "რეტრო სათვალე", price: "45 ₾", condition: "ვინტაჟი", color: "#e5d5b9", photo: "https://images.unsplash.com/photo-1511499767150-a48a237f0083?auto=format&fit=crop&w=800&q=75" },
  { name: "ტრენჩი", price: "140 ₾", condition: "კარგი მდგომარეობა", color: "#d7d6ca", photo: "https://images.unsplash.com/photo-1539533018447-63fcce2678e3?auto=format&fit=crop&w=800&q=75" },
  { name: "ტყავის ქამარი", price: "35 ₾", condition: "როგორც ახალი", color: "#e1c9b7", photo: "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?auto=format&fit=crop&w=800&q=75" },
]

export default function StoreShowcasePage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#f8f5ee] text-[#2c322e]">
        <div className="ui-container pb-16 pt-7 sm:pt-11">
          <nav className="flex flex-wrap items-center justify-between gap-3 border-y border-[#c6c1b5] py-4 text-[11px] font-semibold uppercase tracking-[0.12em]">
            <Link href="/stores?demo=1" className="text-[#8a7969] hover:text-[#293f37]">← მაღაზიების დემო</Link>
            <span className="text-[#a08068]">THE SAMOSELL EDIT · STOREFRONT</span>
          </nav>
          <p role="status" className="mt-5 border-l-[3px] border-[#bd8459] bg-[#efe3d4] px-4 py-3 text-xs leading-6 text-[#75543f]">
            დიზაინის დემო — მაღაზია, პროდუქციის მონაცემები, ფოტოები და ფასები საჩვენებელია. არც ერთი ნივთი რეალურად არ იყიდება.
          </p>
          <section aria-label="Editorial მაღაზიის პროფილი" className="grid gap-9 pt-10 lg:grid-cols-[1.04fr_0.96fr] lg:items-center lg:gap-14">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.23em] text-[#a77459]">INDEPENDENT VINTAGE / DEMO</p>
              <div className="mt-6 flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full border-4 border-white bg-[#293f37] font-serif text-2xl text-white shadow-sm">SA</div>
                <div>
                  <p className="text-sm font-semibold text-[#506553]">Studio Archive</p>
                  <p className="mt-1 text-xs text-[#948577]">თბილისი · Vintage concept store</p>
                </div>
              </div>
              <h1 className="mt-7 font-serif text-[clamp(3.4rem,7vw,6.5rem)] leading-[0.95] tracking-[-0.055em]">Studio<br/><span className="italic text-[#ae795f]">Archive.</span></h1>
              <p className="mt-8 max-w-lg text-base leading-8 text-[#69726a]">ძველი ეპოქის ნივთები ახალი ისტორიებისთვის. ხელით შერჩეული ვინტაჟური ჟაკეტები, ჩანთები და ყოველდღიური სტილის გამორჩეული დეტალები.</p>
              <div className="mt-7 flex flex-wrap gap-6 text-xs font-semibold text-[#738074]"><span>⌖ თბილისი</span><span>6 საჩვენებელი ნივთი</span></div>
              <div className="mt-8 flex flex-wrap gap-3">
                <span className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#293f37] px-7 text-sm font-semibold text-white">მიწერა · დემო</span>
                <span className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#bcb5a8] px-7 text-sm font-semibold">გამოწერა · დემო</span>
              </div>
              <a href="#store-products" className="mt-6 inline-flex min-h-12 items-center justify-center border-b border-[#293f37] text-sm font-semibold">კოლექციის ნახვა ↗</a>
            </div>
            <div className="relative mx-auto h-[390px] w-full max-w-xl sm:h-[525px]">
              <div className="absolute inset-x-5 bottom-10 top-0 rounded-t-[7rem] rounded-b-lg bg-[#d8cbbb] bg-cover bg-center sm:left-[9%]" role="img" aria-label="დემო ბანერის საჩვენებელი მოდის ფოტო" style={{backgroundImage:"url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1200&q=75')"}} />
              <div className="absolute bottom-0 left-0 max-w-[82%] bg-[#efe3d4] p-5 shadow-lg sm:p-8">
                <p className="font-serif text-2xl italic sm:text-3xl">A story worth wearing.</p>
                <p className="mt-2 text-[10px] uppercase tracking-[0.17em] text-[#827469]">PRE-LOVED, ALWAYS LOVED</p>
              </div>
              <span className="absolute right-1 top-7 rounded-full bg-[#293f37] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white">THE EDIT · DEMO</span>
            </div>
          </section>
          <div className="mt-12 grid gap-5 border-y border-[#c6c1b5] py-6 sm:grid-cols-3">
            <div><p className="font-serif text-3xl">6</p><p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#817e75]">საჩვენებელი ნივთი</p></div>
            <div><p className="font-serif text-3xl">Vintage</p><p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#817e75]">კოლექციის ტიპი</p></div>
            <div><p className="font-serif text-3xl">Demo</p><p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#817e75]">შეფასებები გამორთულია</p></div>
          </div>

          <section id="store-products" className="scroll-mt-28 pt-12 sm:pt-16">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#c6c1b5] pb-5">
              <div><p className="text-[11px] uppercase tracking-[0.22em] text-[#ad7558]">THE COLLECTION / DEMO</p><h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">მაღაზიის კოლექცია</h2></div>
              <span className="text-xs tracking-[0.12em] text-[#898275]">06 / DEMO</span>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-x-3 gap-y-9 sm:grid-cols-3 sm:gap-x-6">
              {products.map((product) => (
                <article key={product.name}>
                  <div className="relative aspect-[4/5] overflow-hidden" style={{backgroundColor:product.color}}>
                    <div className="h-full w-full bg-cover bg-center" role="img" aria-label={"საჩვენებელი ფოტო: " + product.name} style={{backgroundImage:"url('" + product.photo + "')"}} />
                    <span className="absolute left-3 top-3 bg-[#f8f5ee]/95 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em]">დემო</span>
                  </div>
                  <p className="mt-4 text-[10px] uppercase tracking-[0.14em] text-[#a77459]">{product.condition}</p>
                  <h3 className="mt-1 text-sm font-semibold leading-6 sm:text-base">{product.name}</h3>
                  <p className="mt-1 font-serif text-xl">{product.price}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-16 flex flex-col gap-5 border-t border-[#c6c1b5] pt-9 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[11px] uppercase tracking-[0.16em] text-[#ae795f]">FOR STORES</p><h2 className="mt-2 font-serif text-3xl">შენი მაღაზიაც ამ სივრცეში.</h2><p className="mt-2 text-sm text-[#6c786e]">დემო მხოლოდ სანახავადაა. რეალური მაღაზიის პროფილი შენს ფოტოებსა და ნივთებს იყენებს.</p></div>
            <Link href="/for-stores" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-[#293f37] px-7 text-sm font-semibold text-white">გაიგე მეტი ↗</Link>
          </section>
        </div>
      </main>
    </>
  )
}
