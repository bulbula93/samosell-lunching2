import type { Metadata } from "next"
import SiteHeader from "@/components/layout/SiteHeader"
import { SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
  title: "თანხის დაბრუნების პოლიტიკა",
  description: `${SITE_NAME}-ის ციფრული სარეკლამო მომსახურებების თანხის დაბრუნების პოლიტიკა`,
  alternates: { canonical: "/refund-policy" },
}

export default function RefundPolicyPage() {
  return <main className="min-h-screen bg-neutral-50 text-neutral-900"><SiteHeader /><section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14"><div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8"><div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">გადახდები</div><h1 className="mt-3 text-3xl font-black sm:text-4xl">თანხის დაბრუნების პოლიტიკა</h1><div className="mt-8 space-y-6 leading-7 text-neutral-700">
    <p>TBC/SamoSell checkout, როდესაც ის ხელმისაწვდომია, გამოიყენება მხოლოდ {SITE_NAME}-ის ციფრული და სარეკლამო მომსახურებებისთვის — მაგალითად VIP, TOP, VIP MAX ან მთავარი გვერდის ბანერი. ის არ ამუშავებს მომხმარებლებს შორის გაყიდული ნივთის ფასს.</p>
    <section><h2 className="text-xl font-black text-neutral-900">როდის შეგიძლია მოთხოვნა</h2><p className="mt-2">მოთხოვნა შეიძლება განიხილებოდეს დუბლირებული გადახდის, გადახდილი მომსახურების გაუქმებელი ტექნიკური ჩავარდნის, მომსახურების არასწორი აქტივაციის ან სხვა დასაბუთებული პრობლემის შემთხვევაში.</p></section>
    <section><h2 className="text-xl font-black text-neutral-900">განხილვის პროცესი</h2><p className="mt-2">მოთხოვნა იგზავნება გადახდების გვერდიდან და გადის შიდა შემოწმებას. მოთხოვნის დამტკიცება თავისთავად არ ნიშნავს, რომ თანხა ბანკში უკვე დაბრუნდა. თანხა დაბრუნებულად ითვლება მხოლოდ provider-ის დადასტურებული Returned სტატუსით, ხოლო ნაწილობრივი დაბრუნება — PartialReturned სტატუსით.</p></section>
    <section><h2 className="text-xl font-black text-neutral-900">ვადა და საბანკო დამუშავება</h2><p className="mt-2">განხილვისა და საბანკო ასახვის დრო დამოკიდებულია შემთხვევის სირთულეზე, ბანკსა და ბარათის გამცემზე. თანხის დაბრუნების დაწყების შემდეგ ანგარიშზე მყისიერი ასახვა გარანტირებული არ არის.</p></section>
    <section><h2 className="text-xl font-black text-neutral-900">დავა</h2><p className="mt-2">თუ გადახდის ან აქტივაციის ჩანაწერები ერთმანეთს არ ემთხვევა, მომსახურება შეიძლება დროებით გადავიდეს შემოწმების რეჟიმში. უსაფრთხო დიაგნოსტიკისთვის ვინახავთ შეკვეთისა და provider სტატუსების audit trail-ს, მაგრამ არა ბარათის ნომერს ან CVV-ს.</p></section>
  </div></div></section></main>
}
