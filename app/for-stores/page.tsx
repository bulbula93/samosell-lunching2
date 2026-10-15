import type { Metadata } from "next"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"
import { isReadOnlyPreview } from "@/lib/preview-read-only"

export const metadata: Metadata = {
  title: "გახსენი მაღაზია — SamoSell Shops",
  description: "შექმენი მაღაზიის ვიტრინა SamoSell-ზე და განათავსე განცხადებები საკომისიოს გარეშე.",
  alternates: { canonical: "/for-stores" },
}

const advantages = [
  {
    n: "01",
    label: "შენი საკუთარი სივრცე",
    title: "საკუთარი ვიტრინა",
    description: "მაღაზიის სახელი, ლოგო, ბანერი და შენი ნივთები ერთ გვერდზე — ბმული, რომლის გაზიარებაც შეგიძლია.",
  },
  {
    n: "02",
    label: "აღმოაჩინონ შენი მაღაზია",
    title: "ახალი აღმოჩენები",
    description: "შენი ნივთები საერთო კატალოგში გამოჩნდება, ხოლო მაღაზიის პროფილი — მაღაზიების სივრცეში.",
  },
  {
    n: "03",
    label: "პირდაპირი კავშირი",
    title: "პირდაპირი კონტაქტი",
    description: "მყიდველი მოგწერს SamoSell-ის ჩათში ან დაგიკავშირდება შენ მიერ დამატებული საკონტაქტო არხებით.",
  },
] as const

const steps = [
  { n: "01", title: "შექმენი ანგარიში", description: "გამოიყენე არსებული SamoSell ანგარიში ან შექმენი ახალი." },
  { n: "02", title: "მიუთითე მაღაზიის ტიპი", description: "პროფილში აირჩიე „მაღაზია“, დაამატე ლოგო, ბანერი და საკონტაქტო ინფორმაცია." },
  { n: "03", title: "გამოაქვეყნე ნივთები", description: "შენი განცხადებები გაერთიანდება მაღაზიის ვიტრინაში და გამოჩნდება კატალოგშიც." },
] as const

export default function ForStoresPage() {
  const isPreview = isReadOnlyPreview()
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen bg-bg text-text">
        <div className="bg-white px-3 pb-9 pt-4 sm:px-4 sm:pb-12">
          <div className="ui-container !px-0">
            <section className="relative overflow-hidden rounded-[30px] border border-[#e8ded3] bg-[#ead0bd] bg-cover bg-center shadow-[0_18px_60px_rgba(7,63,59,0.08)]" style={{ backgroundImage: "url('/brand/samosell-hero-bg.jpg')" }}>
              <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,251,246,0.97)_0%,rgba(255,251,246,0.84)_40%,rgba(255,251,246,0.08)_74%,rgba(255,251,246,0.00)_100%)]" />
              <div className="relative grid min-h-[560px] items-center gap-7 px-6 py-9 sm:px-10 sm:py-12 lg:grid-cols-[0.92fr_1.08fr] lg:gap-12 lg:px-14">
                <div className="relative z-10 max-w-2xl">
                  <p className="text-xs font-black tracking-[0.16em] text-brand">ქართული მაღაზიები SamoSell-ზე</p>
                  <h1 className="mt-5 max-w-[14ch] text-balance text-[clamp(2.5rem,5vw,4.65rem)] font-normal leading-[1.08] tracking-[-0.04em] text-[#172321]">
                    შენს მაღაზიას <span className="text-[#b37f65]">ახალი</span> სივრცე.
                  </h1>
                  <div className="mt-6 max-w-lg rounded-2xl bg-[#fffaf5]/80 px-4 py-3 backdrop-blur-[3px] sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
                    <p className="text-base leading-8 text-text-soft sm:text-lg">შენი კოლექცია უფრო მეტმა ადამიანმა აღმოაჩინოს. გახსენი საკუთარი ვიტრინა SamoSell-ზე, დაამატე ნივთები და დაუკავშირდი მყიდველებს პირდაპირ.</p>
                    <p className="mt-4 text-sm font-semibold text-text-soft">შენი სტილი. შენი ისტორია.</p>
                  </div>
                  <div className="mt-7 flex flex-wrap gap-3">
                    <Link href={isPreview ? "/stores/showcase" : "/register"} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand px-6 text-sm font-black text-white transition hover:bg-brand-hover">
                      {isPreview ? "ვიტრინის დემოს ნახვა ↗" : "გახსენი მაღაზია ↗"}
                    </Link>
                    <Link href="/stores?demo=1" className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-brand/15 bg-white/90 px-6 text-sm font-black text-brand transition hover:bg-white">
                      აღმოაჩინე მაღაზიები
                    </Link>
                  </div>
                  <p className="mt-5 max-w-lg text-xs leading-6 text-text-soft">{isPreview ? "ეს სატესტო ვერსია მხოლოდ სანახავადაა — რეგისტრაცია და მონაცემების შეცვლა გამორთულია." : "განცხადებების განთავსება საკომისიოს გარეშეა. VIP სერვისები არჩევითია."}</p>
                </div>
                <div className="relative z-10 flex min-h-48 items-end justify-end lg:h-[420px]">
                  <div className="w-full max-w-[405px] rounded-[28px] border border-white/70 bg-white/90 p-7 text-center shadow-[0_22px_58px_rgba(7,63,59,0.14)] backdrop-blur-md sm:p-8">
                    <div aria-hidden="true" className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-2xl text-[#e9964f]">★</div>
                    <h2 className="mt-4 text-2xl font-black text-brand sm:text-[28px]">შენი მაღაზიის ვიტრინა</h2>
                    <p className="mx-auto mt-3 max-w-[360px] text-sm leading-7 text-text-soft">ლოგო, ბანერი და ყველა შენი განცხადება ერთ გასაზიარებელ გვერდზე.</p>
                    <Link href="/stores/showcase" className="mt-6 inline-flex min-h-12 items-center justify-center rounded-2xl bg-accent px-7 text-sm font-black text-brand shadow-[0_12px_28px_rgba(233,150,79,0.18)] transition hover:bg-accent-hover">ნახე ვიტრინა ↗</Link>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
        <div className="ui-container">
          <section aria-label="რატომ SamoSell" className="py-14 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#be855f]">01 / შენი შესაძლებლობები</p>
              <h2 className="mt-3 text-4xl font-normal tracking-tight sm:text-5xl">შენი მაღაზია. შენი წესებით.</h2>
              <p className="mt-5 text-sm leading-7 text-[#667167]">SamoSell დამატებითი სივრცეა შენი ნივთებისთვის და არა სოციალური ქსელის ან არსებული მაღაზიის ჩანაცვლება.</p>
            </div>
            <div className="mt-10 grid gap-4 border-t border-line pt-7 md:grid-cols-3">
              {advantages.map((advantage) => (
                <article key={advantage.n} className="min-w-0 rounded-3xl border border-line bg-white p-6 shadow-[0_10px_30px_rgba(7,63,59,0.05)] sm:p-7">
                  <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.15em] text-brand">
                    <span>{advantage.label}</span><span>{advantage.n}</span>
                  </p>
                  <h3 className="mt-8 text-3xl font-semibold leading-tight">{advantage.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-[#687369]">{advantage.description}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="border-y border-line bg-[#fff6ed]">
          <div className="ui-container grid gap-10 py-14 sm:py-20 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-brand">02 / როგორ დაიწყო</p>
              <h2 className="mt-4 text-4xl font-normal leading-[1.1] tracking-tight sm:text-5xl">სამი ნაბიჯი.<br /><span className="italic text-[#be855f]">ერთი ვიტრინა.</span></h2>
              <p className="mt-6 max-w-sm text-sm leading-7 text-[#687369]">საწყის ეტაპზე SamoSell-ის არსებულ პროფილსა და განცხადებების მართვას იყენებ. ახალი სისტემა არ გჭირდება.</p>
            </div>
            <ol className="divide-y divide-[#c8c0b2] border-t border-line">
              {steps.map((step) => (
                <li key={step.n} className="grid grid-cols-[2.8rem_1fr] gap-4 py-6 sm:grid-cols-[4rem_1fr]">
                  <span className="text-3xl font-semibold italic text-[#be855f]">{step.n}</span>
                  <div><h3 className="text-2xl font-semibold">{step.title}</h3><p className="mt-2 max-w-lg text-sm leading-7 text-[#687369]">{step.description}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="ui-container">
          <section className="grid gap-8 border-b border-line py-14 sm:grid-cols-[1fr_auto] sm:items-center sm:py-20">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#be855f]">03 / შენი ვიტრინა</p>
              <h2 className="mt-4 text-4xl font-normal leading-tight tracking-tight sm:text-5xl">ნახე, როგორი შეიძლება იყოს<br /><span className="italic text-[#be855f]">შენი მაღაზიის გვერდი.</span></h2>
              <p className="mt-5 text-sm leading-7 text-[#667167]">საჩვენებელ ვიტრინაში გამოყენებულია გამოგონილი მაღაზია და ნივთები. ნამდვილ გვერდზე გამოჩნდება შენი ფოტოები და განცხადებები.</p>
            </div>
            <Link href="/stores/showcase" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full border border-[#293f37] px-7 text-sm font-semibold transition hover:bg-[#eee6d9]">ვიტრინის დემო ↗</Link>
          </section>
          <section className="py-14 text-center sm:py-20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#be855f]">შენი ახალი ისტორია აქ იწყება</p>
            <h2 className="mx-auto mt-4 max-w-xl text-4xl font-normal leading-tight tracking-tight sm:text-5xl">შენი კოლექცია<br /><span className="italic text-[#be855f]">ახალ სივრცეში.</span></h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href={isPreview ? "/stores/showcase" : "/dashboard/profile"} className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-brand px-7 text-sm font-semibold text-white transition hover:bg-brand-hover">
                {isPreview ? "ნახე ვიტრინის დემო ↗" : "მაღაზიის პროფილის გამართვა ↗"}
              </Link>
              <Link href="/stores" className="inline-flex min-h-12 items-center justify-center rounded-full border border-line px-7 text-sm font-semibold transition hover:bg-[#eee6d9]">მაღაზიების ნახვა</Link>
            </div>
            {isPreview ? <p className="mt-6 text-xs text-[#817e75]">სატესტო რეჟიმი — რეგისტრაცია და განცხადებების გამოქვეყნება გამორთულია.</p> : null}
          </section>
        </div>
      </main>
    </>
  )
}
