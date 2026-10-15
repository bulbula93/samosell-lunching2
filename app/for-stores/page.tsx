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
      <main className="min-h-screen bg-[#f8f5ee] text-[#2c322e]">
        <div className="ui-container pt-7 sm:pt-11">
          <div className="flex flex-wrap items-center justify-between gap-3 border-y border-[#c6c1b5] py-4 text-[10px] font-semibold uppercase tracking-[0.17em] sm:text-[11px]">
            <span>SamoSell-ის რჩეული</span>
            <span className="hidden lg:inline">დამოუკიდებელი მაღაზიები / საქართველო</span>
            <span>მაღაზიებისთვის · 2026</span>
          </div>

          <section className="grid gap-10 py-10 lg:grid-cols-[1.04fr_0.96fr] lg:items-center lg:gap-14 lg:py-14">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-[#a77459]">შენი ახალი ვიტრინა</p>
              <h1 className="mt-6 max-w-2xl font-serif text-[clamp(3.4rem,7.3vw,7.5rem)] leading-[0.99] tracking-[-0.055em]">
                შენს მაღაზიას<br />
                <span className="italic text-[#ae795f]">ახალი</span> სივრცე.
              </h1>
              <p className="mt-7 max-w-lg text-base leading-8 text-[#667167]">
                შენი კოლექცია უფრო მეტმა ადამიანმა აღმოაჩინოს. გახსენი საკუთარი ვიტრინა SamoSell-ზე, დაამატე ნივთები და დაუკავშირდი მყიდველებს პირდაპირ.
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <Link
                  href={isPreview ? "/stores/showcase" : "/register"}
                  className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#293f37] px-7 text-sm font-semibold text-white transition hover:bg-[#3c5748]"
                >
                  {isPreview ? "ვიტრინის დემოს ნახვა ↗" : "გახსენი მაღაზია ↗"}
                </Link>
                <Link
                  href="/stores?demo=1"
                  className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#bcb5a8] px-7 text-sm font-semibold transition hover:bg-[#ede5d8]"
                >
                  აღმოაჩინე მაღაზიები
                </Link>
              </div>
              <p className="mt-6 max-w-lg text-xs leading-6 text-[#817e75]">
                {isPreview
                  ? "სატესტო ვერსია მხოლოდ დიზაინის სანახავადაა. რეგისტრაცია და მონაცემების შეცვლა ამ გარემოში დაბლოკილია."
                  : "განცხადების ჩვეულებრივი განთავსება საკომისიოს გარეშეა. სურვილის შემთხვევაში ხელმისაწვდომია ფასიანი VIP სერვისიც."}
              </p>
              <div className="mt-10 flex flex-wrap gap-x-8 gap-y-2 border-t border-[#cfc9bc] pt-5 text-[11px] uppercase tracking-[0.13em] text-[#817e75]">
                <span>ვინტაჟი</span><span>მეორადი</span><span>დამოუკიდებელი მაღაზიები</span>
              </div>
            </div>

            <div className="relative mx-auto h-[410px] w-full max-w-xl sm:h-[530px]">
              <div
                role="img"
                aria-label="საჩვენებელი მოდის ფოტო"
                className="absolute inset-x-5 bottom-10 top-0 rounded-t-[8rem] rounded-b-xl bg-[#ded4c7] bg-cover bg-center sm:left-[9%]"
                style={{ backgroundImage: "url('https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1100&q=75')" }}
              />
              <div className="absolute bottom-0 left-0 max-w-[82%] bg-[#efe3d4] p-5 shadow-lg sm:p-8">
                <p className="font-serif text-xl italic leading-snug sm:text-2xl">შენი სტილი. შენი ისტორია.</p>
                <p className="mt-2 text-[10px] tracking-[0.08em] text-[#827469]">მაღაზია, რომლის აღმოჩენაც ღირს</p>
              </div>
              <span className="absolute right-1 top-7 rounded-full bg-[#293f37] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-white">რჩეული · მაღაზიები</span>
            </div>
          </section>

          <section aria-label="რატომ SamoSell" className="border-t border-[#c6c1b5] py-14 sm:py-20">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ae795f]">01 / შენი შესაძლებლობები</p>
              <h2 className="mt-3 font-serif text-4xl tracking-tight sm:text-5xl">შენი მაღაზია. შენი წესებით.</h2>
              <p className="mt-5 text-sm leading-7 text-[#667167]">SamoSell დამატებითი სივრცეა შენი ნივთებისთვის და არა სოციალური ქსელის ან არსებული მაღაზიის ჩანაცვლება.</p>
            </div>
            <div className="mt-10 grid gap-7 border-t border-[#c6c1b5] pt-7 md:grid-cols-3">
              {advantages.map((advantage) => (
                <article key={advantage.n} className="min-w-0 border-b border-[#c6c1b5] pb-7 md:border-b-0">
                  <p className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.15em] text-[#a77459]">
                    <span>{advantage.label}</span><span>{advantage.n}</span>
                  </p>
                  <h3 className="mt-8 font-serif text-3xl leading-tight">{advantage.title}</h3>
                  <p className="mt-4 text-sm leading-7 text-[#687369]">{advantage.description}</p>
                </article>
              ))}
            </div>
          </section>
        </div>

        <section className="border-y border-[#c6c1b5] bg-[#efe8dd]">
          <div className="ui-container grid gap-10 py-14 sm:py-20 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#a77459]">02 / როგორ დაიწყო</p>
              <h2 className="mt-4 font-serif text-4xl leading-[1.1] tracking-tight sm:text-5xl">სამი ნაბიჯი.<br /><span className="italic text-[#ae795f]">ერთი ვიტრინა.</span></h2>
              <p className="mt-6 max-w-sm text-sm leading-7 text-[#687369]">საწყის ეტაპზე SamoSell-ის არსებულ პროფილსა და განცხადებების მართვას იყენებ. ახალი სისტემა არ გჭირდება.</p>
            </div>
            <ol className="divide-y divide-[#c8c0b2] border-t border-[#c8c0b2]">
              {steps.map((step) => (
                <li key={step.n} className="grid grid-cols-[2.8rem_1fr] gap-4 py-6 sm:grid-cols-[4rem_1fr]">
                  <span className="font-serif text-3xl italic text-[#ae795f]">{step.n}</span>
                  <div><h3 className="font-serif text-2xl">{step.title}</h3><p className="mt-2 max-w-lg text-sm leading-7 text-[#687369]">{step.description}</p></div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <div className="ui-container">
          <section className="grid gap-8 border-b border-[#c6c1b5] py-14 sm:grid-cols-[1fr_auto] sm:items-center sm:py-20">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ae795f]">03 / შენი ვიტრინა</p>
              <h2 className="mt-4 font-serif text-4xl leading-tight tracking-tight sm:text-5xl">ნახე, როგორი შეიძლება იყოს<br /><span className="italic text-[#ae795f]">შენი მაღაზიის გვერდი.</span></h2>
              <p className="mt-5 text-sm leading-7 text-[#667167]">საჩვენებელ ვიტრინაში გამოყენებულია გამოგონილი მაღაზია და ნივთები. ნამდვილ გვერდზე გამოჩნდება შენი ფოტოები და განცხადებები.</p>
            </div>
            <Link href="/stores/showcase" className="inline-flex min-h-12 shrink-0 items-center justify-center rounded-full border border-[#293f37] px-7 text-sm font-semibold transition hover:bg-[#eee6d9]">ვიტრინის დემო ↗</Link>
          </section>
          <section className="py-14 text-center sm:py-20">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#ae795f]">შენი ახალი ისტორია აქ იწყება</p>
            <h2 className="mx-auto mt-4 max-w-xl font-serif text-4xl leading-tight tracking-tight sm:text-5xl">შენი კოლექცია<br /><span className="italic text-[#ae795f]">ახალ სივრცეში.</span></h2>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link href={isPreview ? "/stores/showcase" : "/dashboard/profile"} className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#293f37] px-7 text-sm font-semibold text-white transition hover:bg-[#3c5748]">
                {isPreview ? "ნახე ვიტრინის დემო ↗" : "მაღაზიის პროფილის გამართვა ↗"}
              </Link>
              <Link href="/stores" className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#bcb5a8] px-7 text-sm font-semibold transition hover:bg-[#eee6d9]">მაღაზიების ნახვა</Link>
            </div>
            {isPreview ? <p className="mt-6 text-xs text-[#817e75]">სატესტო რეჟიმი — რეგისტრაცია და განცხადებების გამოქვეყნება გამორთულია.</p> : null}
          </section>
        </div>
      </main>
    </>
  )
}
