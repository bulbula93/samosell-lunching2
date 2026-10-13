import type { Metadata } from "next"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"

export const metadata: Metadata = {
  title: "გახსენი მაღაზია — SamoSell Shops",
  description: "შექმენი შენი მაღაზიის ვიტრინა SamoSell-ზე და განათავსე ტანსაცმლის განცხადებები საკომისიოს გარეშე.",
  alternates: { canonical: "/for-stores" },
}

const benefits = [
  { number: "01", icon: "✳", title: "საკუთარი ვიტრინა", description: "ლოგო, მაღაზიის ინფორმაცია და ყველა შენი განცხადება ერთ გასაზიარებელ გვერდზე." },
  { number: "02", icon: "↗", title: "დამატებითი აუდიტორია", description: "აღმოაჩინონ შენი პროდუქცია SamoSell-ის კატალოგში და მაღაზიების სივრცეში." },
  { number: "03", icon: "◎", title: "პირდაპირი კონტაქტი", description: "მყიდველები მოგწერენ ჩათში ან დაგიკავშირდებიან შენ მიერ მითითებული არხებით." },
]

export default function ForStoresPage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-[#faf9f6] text-[#073f3b]">
        <section className="relative overflow-hidden bg-[#073f3b] text-white">
          <div className="pointer-events-none absolute -right-32 -top-40 h-[35rem] w-[35rem] rounded-full bg-[#226d5f] opacity-70 blur-3xl" aria-hidden="true" />
          <div className="ui-container relative grid gap-12 py-16 sm:py-24 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <div className="inline-flex items-center rounded-full border border-[#639b8d] px-4 py-2 text-xs font-bold tracking-[0.15em] text-[#a4e1cb]">SAMOSELL SHOPS · FOR BUSINESS</div>
              <h1 className="mt-7 max-w-2xl text-4xl font-black leading-[1.1] tracking-[-0.045em] sm:text-5xl lg:text-6xl">
                შენ გაქვს ნივთები.
                <span className="mt-2 block text-[#ffb77a]">ჩვენ — კიდევ ერთი ვიტრინა.</span>
              </h1>
              <p className="mt-7 max-w-xl text-base leading-8 text-[#d4e7de]">
                შექმენი შენი მაღაზიის გვერდი SamoSell-ზე. განათავსე ტანსაცმელი, გააცანი პროდუქცია ახალ მომხმარებლებს და მიიღე შეტყობინებები პირდაპირ.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link href="/register" className="inline-flex min-h-13 items-center justify-center rounded-full bg-[#ffad70] px-7 py-3.5 text-sm font-black text-[#073f3b] transition hover:bg-[#ffbf92]">
                  შექმენი ანგარიში ↗
                </Link>
                <Link href="/stores?demo=1" className="inline-flex min-h-13 items-center justify-center rounded-full border border-white/40 px-7 py-3.5 text-sm font-bold text-white transition hover:bg-white/10">
                  ნახე როგორ გამოიყურება
                </Link>
              </div>
              <p className="mt-5 text-xs leading-6 text-[#afcdc1]">განცხადებების განთავსება საკომისიოს გარეშეა. ფასიანი VIP გამოჩენა არჩევითია.</p>
            </div>
            <div aria-hidden="true" className="relative mx-auto w-full max-w-sm">
              <div className="absolute -left-6 top-9 h-full w-full rotate-[-8deg] rounded-[2rem] bg-[#387c69]" />
              <div className="relative overflow-hidden rounded-[2rem] bg-[#f8eee2] p-5 text-[#073f3b] shadow-2xl">
                <div className="h-36 rounded-[1.2rem] bg-[#e0c7b4]">
                  <div className="flex h-full items-center justify-center text-6xl text-[#8e5d45]">✳</div>
                </div>
                <div className="relative -mt-7 ml-4 flex h-16 w-16 items-center justify-center rounded-2xl border-4 border-[#f8eee2] bg-[#075a53] text-xl font-black text-white">S</div>
                <div className="mt-3 text-xl font-black">Your vintage store</div>
                <p className="mt-1 text-xs text-[#7c8b81]">შენი სტილი. შენი სივრცე.</p>
                <div className="mt-6 grid grid-cols-3 gap-2">
                  <div className="h-28 rounded-xl bg-[#d4d5c9]" />
                  <div className="h-28 rounded-xl bg-[#ccaa8e]" />
                  <div className="h-28 rounded-xl bg-[#c6d7cd]" />
                </div>
                <div className="mt-5 h-9 rounded-full bg-[#075a53]" />
              </div>
            </div>
          </div>
        </section>

        <section className="ui-container py-16 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-xs font-black tracking-[0.18em] text-[#cf7745]">WHY SAMOSELL?</p>
            <h2 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">მეტი ადგილი შენი ნივთებისთვის.</h2>
            <p className="mt-4 text-sm leading-7 text-[#62796f]">Instagram-ის გარდა, შენს მაღაზიას ექნება საკუთარი გვერდი, რომლის გაზიარებაც მყიდველებთან შეგიძლია.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {benefits.map((item) => (
              <article key={item.number} className="rounded-[1.7rem] border border-[#e2e8e0] bg-white p-7 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-black text-[#d77f47]">{item.icon}</span>
                  <span className="text-xs font-black text-[#a3b3a8]">{item.number}</span>
                </div>
                <h3 className="mt-8 text-xl font-black">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-[#62796f]">{item.description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-[#e4e7df] bg-[#edf1e9]">
          <div className="ui-container grid gap-10 py-14 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
            <div>
              <p className="text-xs font-black tracking-[0.18em] text-[#bd7444]">HOW IT WORKS</p>
              <h2 className="mt-3 text-3xl font-black">დაიწყე სამი ნაბიჯით</h2>
              <p className="mt-4 text-sm leading-7 text-[#61776d]">სატესტო ეტაპზე უკვე არსებულ ანგარიშის ფუნქციებს ვიყენებთ. დამატებითი სარეგისტრაციო ფორმა ჯერ საჭირო არ არის.</p>
            </div>
            <ol className="space-y-4">
              <li className="flex gap-4 rounded-2xl bg-white p-5"><span className="font-black text-[#c97744]">01</span><div><h3 className="font-bold">დარეგისტრირდი</h3><p className="mt-1 text-sm text-[#62796f]">შექმენი SamoSell ანგარიში ან შედი არსებულში.</p></div></li>
              <li className="flex gap-4 rounded-2xl bg-white p-5"><span className="font-black text-[#c97744]">02</span><div><h3 className="font-bold">პროფილში აირჩიე „მაღაზია“</h3><p className="mt-1 text-sm text-[#62796f]">დაამატე ლოგო, მაღაზიის სახელი და საკონტაქტო ინფორმაცია.</p></div></li>
              <li className="flex gap-4 rounded-2xl bg-white p-5"><span className="font-black text-[#c97744]">03</span><div><h3 className="font-bold">გამოაქვეყნე განცხადებები</h3><p className="mt-1 text-sm text-[#62796f]">ნივთები გამოჩნდება კატალოგში და შენი მაღაზიის გვერდზე.</p></div></li>
            </ol>
          </div>
        </section>

        <section className="ui-container py-16 text-center">
          <p className="text-xs font-black tracking-[0.2em] text-[#be7649]">READY?</p>
          <h2 className="mx-auto mt-3 max-w-xl text-3xl font-black leading-tight">შენი პირველი ონლაინ ვიტრინა მზად არის დასაწყებად.</h2>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/dashboard/profile" className="inline-flex min-h-12 items-center rounded-full bg-[#075a53] px-7 text-sm font-bold text-white">მაღაზიის პროფილის გამართვა ↗</Link>
            <Link href="/stores" className="inline-flex min-h-12 items-center rounded-full border border-[#b8cdc1] px-7 text-sm font-bold text-[#075a53]">მაღაზიების ნახვა</Link>
          </div>
        </section>
      </main>
    </>
  )
}
