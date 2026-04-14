import type { Metadata } from "next"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"
import { SITE_NAME, getSupportConfig } from "@/lib/site"

export const metadata: Metadata = {
  title: "დახმარება და კონტაქტი",
  description: `${SITE_NAME}-ის დახმარებისა და კონტაქტის გვერდი.`,
  alternates: {
    canonical: "/contact",
  },
}

export default function ContactPage() {
  const support = getSupportConfig()

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">დახმარება</div>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">როგორ დაგვეკონტაქტო</h1>
          <p className="mt-4 max-w-2xl leading-7 text-neutral-700">
            თუ გაქვს ტექნიკური პრობლემა, შეკითხვა ანგარიშზე, განცხადებაზე, ჩათზე ან უსაფრთხოებაზე, ქვემოთ სწორ არხს სწრაფად იპოვი.
            ყველაზე მგრძნობიარე შემთხვევებისთვის გამოიყენე უსაფრთხოების მისამართი.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.15em] text-neutral-500">მხარდაჭერა</div>
              <a href={`mailto:${support.supportEmail}`} className="mt-3 block text-lg font-black text-neutral-900 underline decoration-neutral-300 underline-offset-4">
                {support.supportEmail}
              </a>
              <p className="mt-2 text-sm leading-6 text-neutral-600">ანგარიშის, განცხადების, ჩათისა და ტექნიკური საკითხებისთვის.</p>
            </div>
            <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.15em] text-neutral-500">პასუხის დრო</div>
              <div className="mt-3 text-lg font-black text-neutral-900">{support.responseTime}</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">საშუალო დრო, რა პერიოდშიც მხარდაჭერის გუნდი გპასუხობს.</p>
            </div>
            <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.15em] text-neutral-500">სამუშაო საათები</div>
              <div className="mt-3 text-lg font-black text-neutral-900">{support.businessHours}</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">ამ პერიოდში პასუხის მიღება ყველაზე სწრაფად არის მოსალოდნელი.</p>
            </div>
            <div className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5">
              <div className="text-sm font-semibold uppercase tracking-[0.15em] text-neutral-500">უსაფრთხოება</div>
              <a href={`mailto:${support.trustEmail}`} className="mt-3 block text-lg font-black text-neutral-900 underline decoration-neutral-300 underline-offset-4">
                {support.trustEmail}
              </a>
              <p className="mt-2 text-sm leading-6 text-neutral-600">თაღლითობა, სხვისადმი თავის გასაღება ან წესების დარღვევა აქ გამოგზავნე.</p>
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Link href="/faq" className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 transition hover:border-neutral-300 hover:bg-white">
              <div className="text-base font-black text-neutral-900">ხშირად დასმული კითხვები</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">სწრაფი პასუხები ყველაზე ხშირ კითხვებზე განცხადებების, ჩათისა და პროფილის შესახებ.</p>
            </Link>
            <Link href="/safety" className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 transition hover:border-neutral-300 hover:bg-white">
              <div className="text-base font-black text-neutral-900">უსაფრთხოების რჩევები</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">გადაამოწმე პროფილი, კომუნიკაცია და გადახდის პირობები სანამ გარიგებას დაასრულებ.</p>
            </Link>
            <Link href="/sell-fast" className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 transition hover:border-neutral-300 hover:bg-white">
              <div className="text-base font-black text-neutral-900">როგორ გაყიდო სწრაფად</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">ფოტოს, სათაურის, ფასისა და აღწერის მოკლე ჩეკლისტი უკეთესი შედეგისთვის.</p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
