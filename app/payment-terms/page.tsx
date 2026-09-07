import type { Metadata } from "next"
import SiteHeader from "@/components/layout/SiteHeader"
import { SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
  title: "გადახდის პირობები",
  description: `${SITE_NAME}-ის ციფრული სარეკლამო მომსახურებების გადახდის პირობები`,
  alternates: { canonical: "/payment-terms" },
}

export default function PaymentTermsPage() {
  return <main className="min-h-screen bg-neutral-50 text-neutral-900"><SiteHeader /><section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14"><div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8"><div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">გადახდები</div><h1 className="mt-3 text-3xl font-black sm:text-4xl">გადახდის პირობები</h1><div className="mt-8 space-y-6 leading-7 text-neutral-700">
    <p>{SITE_NAME}-ის გადახდის ფუნქცია ეხება მხოლოდ პლატფორმის ფასიან ციფრულ მომსახურებებს. მომხმარებლებს შორის ნივთის ყიდვა-გაყიდვის თანხა ამ checkout-ით არ მუშავდება.</p>
    <section><h2 className="text-xl font-black text-neutral-900">ფასი და ვალუტა</h2><p className="mt-2">გადასახდელი თანხა და GEL ვალუტა განისაზღვრება აქტიური SamoSell პაკეტის მონაცემებით. ბრაუზერიდან მიწოდებული თვითნებური ფასი, ვალუტა ან მომსახურების ვადა არ გამოიყენება.</p></section>
    <section><h2 className="text-xl font-black text-neutral-900">TBC Checkout</h2><p className="mt-2">TBC Checkout გამოჩნდება მხოლოდ ბანკის დამტკიცების, server-side feature flag-ის ჩართვისა და აუცილებელი production credential-ების არსებობის შემდეგ. ბრაუზერში საიდუმლო credential არ იგზავნება.</p></section>
    <section><h2 className="text-xl font-black text-neutral-900">დადასტურება და აქტივაცია</h2><p className="mt-2">ბრაუზერის დაბრუნების გვერდი წარმატებულ გადახდას არ ადასტურებს. სისტემა provider სტატუსს server-side ამოწმებს და მომსახურებას მხოლოდ Succeeded სტატუსის, სწორი თანხისა და სწორი ვალუტის შემთხვევაში ააქტიურებს.</p></section>
    <section><h2 className="text-xl font-black text-neutral-900">წარუმატებელი ან დაგვიანებული გადახდა</h2><p className="mt-2">Created, Processing და სხვა შუალედური სტატუსები შეიძლება მოგვიანებით განახლდეს callback-ით ან ხელით გადამოწმებით. Failed, Expired და Cancelled მდგომარეობები მომსახურებას არ ააქტიურებს.</p></section>
  </div></div></section></main>
}
