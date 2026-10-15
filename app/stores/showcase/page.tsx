import type { Metadata } from "next"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"
import StoreVipCard, { type StoreVipListing } from "@/components/stores/StoreVipCard"

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

const sampleStoreVip: StoreVipListing = {
  id: "demo-studio-vip",
  slug: "demo-studio-vip",
  title: "კლასიკური ვინტაჟური ჟაკეტი",
  price: 85,
  currency: "GEL",
  sale_type: "sell",
  cover_image_url: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=75",
  is_vip: true,
  is_featured: true,
  promotion_tier: 3,
  published_at: null,
  seller_id: "demo-studio",
  seller_username: "demo-studio",
  seller_full_name: "სტუდიო არქივი",
  seller_store_logo_url: null,
}

export default function StoreShowcasePage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-bg text-text">
        <div className="ui-container pb-16 pt-6 sm:pt-10">
          <nav className="flex flex-wrap items-center justify-between gap-3 border-y border-line py-4 text-[11px] font-semibold uppercase tracking-[0.12em]">
            <Link href="/stores?demo=1" className="text-[#8a7969] hover:text-[#293f37]">← მაღაზიების დემო</Link>
            <span className="text-[#a08068]">SamoSell-ის რჩეული · ვიტრინა</span>
          </nav>
          <p role="status" className="mt-5 border-l-[3px] border-[#bd8459] bg-[#efe3d4] px-4 py-3 text-xs leading-6 text-[#75543f]">
            დიზაინის დემო — მაღაზია, პროდუქციის მონაცემები, ფოტოები და ფასები საჩვენებელია. არც ერთი ნივთი რეალურად არ იყიდება.
          </p>
          <div className="mt-5"><Link href="/stores/hero-editor" className="inline-flex min-h-12 items-center rounded-xl bg-brand px-5 text-sm font-bold text-white">შექმენი შენი ვიტრინის ტექსტები ↗</Link></div>
          <section aria-label="მაღაზიის პროფილი" className="relative mt-6 grid gap-9 overflow-hidden rounded-[30px] border border-[#e8ded3] bg-[linear-gradient(115deg,#fffaf5_0%,#f8e7d9_48%,#edd3c0_100%)] px-6 py-9 shadow-[0_18px_60px_rgba(7,63,59,0.08)] sm:px-10 sm:py-12 lg:grid-cols-[1.04fr_0.96fr] lg:items-center lg:gap-14">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.23em] text-[#a77459]">დამოუკიდებელი ვინტაჟი / დემო</p>
              <div className="mt-6 flex items-center gap-4">
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border-4 border-white bg-brand text-2xl font-black text-white shadow-sm">სა</div>
                <div>
                  <p className="text-sm font-semibold text-[#506553]">სტუდიო არქივი</p>
                  <p className="mt-1 text-xs text-[#948577]">თბილისი · ვინტაჟური მაღაზია</p>
                </div>
              </div>
              <h1 className="mt-7 text-[clamp(2.6rem,5vw,4.8rem)] font-normal leading-[1.07] tracking-[-0.04em] text-[#172321]">სტუდიო<br/><span className="italic text-[#b37f65]">არქივი.</span></h1>
              <p className="mt-8 max-w-lg text-base leading-8 text-[#69726a]">ძველი ეპოქის ნივთები ახალი ისტორიებისთვის. ხელით შერჩეული ვინტაჟური ჟაკეტები, ჩანთები და ყოველდღიური სტილის გამორჩეული დეტალები.</p>
              <div className="mt-7 flex flex-wrap gap-6 text-xs font-semibold text-[#738074]"><span>⌖ თბილისი</span><span>6 საჩვენებელი ნივთი</span></div>
              <div className="mt-8 flex flex-wrap gap-3">
                <span className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand px-7 text-sm font-black text-white">მიწერა · დემო</span>
                <span className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-line bg-white/85 px-7 text-sm font-bold">გამოწერა · დემო</span>
              </div>
              <a href="#store-products" className="mt-6 inline-flex min-h-12 items-center justify-center border-b border-[#293f37] text-sm font-semibold">კოლექციის ნახვა ↗</a>
            </div>
            <div className="relative mx-auto h-[330px] w-full max-w-xl sm:h-[480px]">
              <div
                role="img"
                aria-label="საჩვენებელი მაღაზიის ქავერი — მზიანი ბუტიკის ინტერიერი"
                className="absolute inset-x-0 bottom-10 top-0 rounded-[26px] bg-[#e3c9b5] bg-cover bg-center sm:left-[6%]"
                style={{ backgroundImage: "url('/brand/samosell-shops-boutique.webp')" }}
              />
              <div className="absolute bottom-0 left-0 max-w-[84%] rounded-[24px] border border-white/80 bg-white/90 p-5 shadow-[0_18px_40px_rgba(7,63,59,0.11)] backdrop-blur-md sm:p-7">
                <p className="text-xl font-semibold leading-snug text-brand sm:text-2xl">ნივთები, რომელთაც ისტორია აქვთ.</p>
                <p className="mt-2 text-xs text-text-soft">მაღაზიის ქავერი · საჩვენებელი ფოტო</p>
              </div>
              <span className="absolute right-2 top-5 rounded-full bg-brand px-4 py-2 text-[10px] font-bold text-white">მაღაზიის ვიტრინა</span>
            </div>
          </section>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div><p className="text-3xl font-black text-brand">6</p><p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#817e75]">საჩვენებელი ნივთი</p></div>
            <div><p className="text-3xl font-black text-brand">ვინტაჟი</p><p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#817e75]">კოლექციის ტიპი</p></div>
            <div><p className="text-3xl font-black text-brand">დემო</p><p className="mt-1 text-xs uppercase tracking-[0.12em] text-[#817e75]">შეფასებები გამორთულია</p></div>
          </div>

          <section id="demo-store-vip" aria-labelledby="demo-vip-heading" className="scroll-mt-28 border-b border-line pb-12 pt-12 sm:pb-16 sm:pt-16">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
              <div>
                <p className="text-xs font-semibold text-[#a77459]">მაღაზიის გამორჩეული ნივთები · დემო</p>
                <h2 id="demo-vip-heading" className="mt-2 text-3xl font-semibold tracking-tight text-brand sm:text-4xl">მაღაზიის VIP განცხადებები</h2>
              </div>
              <span className="rounded-full border border-[#e6c9a9] bg-[#fff3e5] px-4 py-2 text-xs font-bold text-[#91613d]">საჩვენებელი VIP</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <StoreVipCard item={sampleStoreVip} demo />
            </div>
          </section>

          <section id="store-products" className="scroll-mt-28 pt-12 sm:pt-16">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
              <div><p className="text-[11px] uppercase tracking-[0.22em] text-[#ad7558]">კოლექცია / დემო</p><h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">მაღაზიის კოლექცია</h2></div>
              <span className="text-xs tracking-[0.12em] text-[#898275]">06 / დემო</span>
            </div>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
              {products.map((product) => (
                <article key={product.name} className="rounded-[22px] border border-line bg-white p-2 shadow-[0_10px_30px_rgba(7,63,59,0.05)] sm:p-3">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-2xl" style={{backgroundColor:product.color}}>
                    <div className="h-full w-full bg-cover bg-center" role="img" aria-label={"საჩვენებელი ფოტო: " + product.name} style={{backgroundImage:"url('" + product.photo + "')"}} />
                    <span className="absolute left-3 top-3 bg-[#f8f5ee]/95 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.12em]">დემო</span>
                  </div>
                  <p className="mt-4 text-[10px] uppercase tracking-[0.14em] text-[#a77459]">{product.condition}</p>
                  <h3 className="mt-1 text-sm font-semibold leading-6 sm:text-base">{product.name}</h3>
                  <p className="mt-1 text-xl font-bold text-brand">{product.price}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="mt-16 flex flex-col gap-5 border-t border-line pt-9 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-[11px] uppercase tracking-[0.16em] text-[#b37f65]">მაღაზიებისთვის</p><h2 className="mt-2 text-2xl font-semibold text-brand">შენი მაღაზიაც ამ სივრცეში.</h2><p className="mt-2 text-sm text-[#6c786e]">დემო მხოლოდ სანახავადაა. რეალური მაღაზიის პროფილი შენს ფოტოებსა და ნივთებს იყენებს.</p></div>
            <Link href="/for-stores" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full bg-brand px-7 text-sm font-semibold text-white">გაიგე მეტი ↗</Link>
          </section>
        </div>
      </main>
    </>
  )
}
