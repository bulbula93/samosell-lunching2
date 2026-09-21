import type { Metadata } from "next"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"
import PaymentMethodMarks from "@/components/payments/PaymentMethodMarks"
import { SITE_NAME, getSupportConfig } from "@/lib/site"

export const metadata: Metadata = {
  title: "გადახდის პირობები",
  description: `${SITE_NAME}-ის ციფრული სარეკლამო მომსახურებების გადახდის პირობები`,
  alternates: { canonical: "/payment-terms" },
}

const services = [
  {
    code: "vip_7d",
    name: "VIP",
    price: "9.90 GEL",
    description: "7 დღით VIP ბეჯი, VIP განცხადებების ჰორიზონტალურ სექციაში გამოჩენა და დამატებითი ხილვადობა კატალოგში.",
  },
  {
    code: "promoted_7d",
    name: "TOP",
    price: "14.90 GEL",
    description: "7 დღით უფრო მაღალი პოზიცია კატალოგსა და შესაბამის კატეგორიაში.",
  },
  {
    code: "combo_7d",
    name: "VIP MAX",
    price: "34.90 GEL",
    description: "7 დღით VIP + TOP უპირატესობები და მთავარი გვერდის VIP MAX Hero Carousel-ში განთავსება.",
  },
  {
    code: "home_banner_7d",
    name: "Home Banner",
    price: "39.90 GEL",
    description: "7 დღით განცხადების განთავსება მთავარი გვერდის დიდ სარეკლამო ბანერში.",
  },
  {
    code: "home_brand_ad_7d",
    name: "Home Brand Ad",
    price: "49.90 GEL",
    description: "7 დღით ბრენდის რეკლამა მთავარი გვერდის ერთ-ერთ ორ სპეციალურ სარეკლამო ბლოკში, მომხმარებლის მიერ მითითებულ SamoSell მაღაზიის, სოციალური ქსელის ან ვებგვერდის ბმულით.",
  },
] as const

export default function PaymentTermsPage() {
  const support = getSupportConfig()

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">გადახდები</div>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">გადახდის პირობები</h1>
          <p className="mt-4 max-w-3xl leading-7 text-neutral-700">
            {SITE_NAME}-ის checkout გამოიყენება მხოლოდ პლატფორმის ფასიანი ციფრული სარეკლამო მომსახურებებისთვის.
            მომხმარებლებს შორის ნივთის ყიდვა-გაყიდვის თანხას SamoSell არ იღებს და ამ checkout-ით არ ამუშავებს.
          </p>

          <section className="mt-8">
            <h2 className="text-2xl font-black">მომსახურებები, ფასი და საიდენტიფიკაციო კოდი</h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {services.map((service) => (
                <article key={service.code} className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xl font-black">{service.name}</div>
                      <div className="mt-1 font-mono text-xs text-neutral-500">კოდი: {service.code}</div>
                    </div>
                    <div className="rounded-xl bg-[#073f3b] px-3 py-2 text-sm font-black text-white">{service.price}</div>
                  </div>
                  <p className="mt-4 text-sm leading-6 text-neutral-700">{service.description}</p>
                </article>
              ))}
            </div>
            <p className="mt-3 text-sm leading-6 text-neutral-600">ყველა ფასი მითითებულია ლარში (GEL) და საბოლოო თანხა checkout-ის დაწყებამდე ჩანს.</p>
          </section>

          <section className="mt-8 rounded-[1.5rem] border border-neutral-200 p-5">
            <h2 className="text-xl font-black">გადახდის მეთოდები</h2>
            <p className="mt-2 text-sm leading-6 text-neutral-700">
              Flitt-ის დაცულ გადახდის გვერდზე მხარდაჭერილი მეთოდებია Visa/Mastercard ბარათით გადახდა, Apple Pay და Google Pay.
              კონკრეტული wallet-ის ხელმისაწვდომობა შეიძლება დამოკიდებული იყოს მოწყობილობაზე, ბრაუზერზე, ბარათზე და მერჩანტის აქტიურ კონფიგურაციაზე.
            </p>
            <div className="mt-4"><PaymentMethodMarks /></div>
          </section>

          <div className="mt-8 space-y-6 leading-7 text-neutral-700">
            <section>
              <h2 className="text-xl font-black text-neutral-900">მომსახურების მიწოდება / აქტივაცია</h2>
              <p className="mt-2">
                მომსახურება ციფრულია და ფიზიკურ მიწოდებას არ საჭიროებს. წარმატებული გადახდის server-to-server დადასტურების შემდეგ არჩეული პაკეტი ავტომატურად აქტიურდება შესაბამის განცხადებაზე და მოქმედებს 7 დღე.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-black text-neutral-900">გადახდის დადასტურება</h2>
              <p className="mt-2">
                მხოლოდ ბრაუზერის დაბრუნების გვერდი წარმატებულ გადახდას არ ადასტურებს. სისტემა provider-ის სტატუსს server-side ამოწმებს და მომსახურებას მხოლოდ დამტკიცებული სტატუსის, სწორი თანხისა და GEL ვალუტის შემთხვევაში ააქტიურებს.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-black text-neutral-900">წარუმატებელი ან დაგვიანებული გადახდა</h2>
              <p className="mt-2">
                დაუდასტურებელი, უარყოფილი, გაუქმებული ან ვადაგასული გადახდა მომსახურებას არ ააქტიურებს. შუალედური სტატუსი შეიძლება მოგვიანებით განახლდეს provider callback-ით ან უსაფრთხო server-side გადამოწმებით.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-black text-neutral-900">თანხის დაბრუნება</h2>
              <p className="mt-2">
                დაბრუნების საფუძვლები და დამუშავების პროცესი აღწერილია <Link href="/refund-policy" className="font-semibold text-[#073f3b] underline underline-offset-4">თანხის დაბრუნების პოლიტიკაში</Link>.
                გადახდასთან დაკავშირებული მოთხოვნისთვის მოგვწერე <a href={`mailto:${support.supportEmail}`} className="font-semibold text-[#073f3b] underline underline-offset-4">{support.supportEmail}</a>-ზე.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}
