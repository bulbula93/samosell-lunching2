import type { Metadata } from "next"
import SiteHeader from "@/components/layout/SiteHeader"
import { SITE_NAME, getSupportConfig } from "@/lib/site"

export const metadata: Metadata = {
  title: "თანხის დაბრუნების პოლიტიკა",
  description: `${SITE_NAME}-ის ციფრული სარეკლამო მომსახურებების თანხის დაბრუნების პოლიტიკა`,
  alternates: { canonical: "/refund-policy" },
}

export default function RefundPolicyPage() {
  const support = getSupportConfig()

  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">გადახდები</div>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">თანხის დაბრუნების პოლიტიკა</h1>
          <div className="mt-8 space-y-6 leading-7 text-neutral-700">
            <p>
              SamoSell-ის checkout გამოიყენება მხოლოდ VIP, TOP, VIP MAX და Home Banner ციფრული სარეკლამო მომსახურებებისთვის.
              მომხმარებლებს შორის ნივთის გაყიდვის თანხა ამ გადახდის სისტემით არ მუშავდება.
            </p>
            <section>
              <h2 className="text-xl font-black text-neutral-900">როდის განიხილება დაბრუნება</h2>
              <p className="mt-2">
                მოთხოვნა შეიძლება განიხილებოდეს დუბლირებული ჩამოჭრის, გადახდილი მომსახურების ტექნიკური ჩავარდნის, მომსახურების არასწორი აქტივაციის ან სხვა დადასტურებადი გადახდის პრობლემის შემთხვევაში.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-black text-neutral-900">როგორ მოითხოვო დაბრუნება</h2>
              <p className="mt-2">
                მოგვწერე <a href={`mailto:${support.supportEmail}`} className="font-semibold text-[#073f3b] underline underline-offset-4">{support.supportEmail}</a>-ზე და მიუთითე ანგარიშის ელფოსტა, მომსახურების კოდი, შეკვეთის/გადახდის იდენტიფიკატორი და პრობლემის მოკლე აღწერა. ბარათის სრული ნომერი ან CVV არ გამოგზავნო.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-black text-neutral-900">განხილვა და დაბრუნების არხი</h2>
              <p className="mt-2">
                მოთხოვნა მოწმდება SamoSell-ის შეკვეთისა და provider-ის გადახდის ჩანაწერების მიხედვით. დამტკიცებული დაბრუნება ინიცირდება იმავე გადახდის არხზე, საიდანაც თანხა იყო მიღებული. ბანკში/ბარათზე საბოლოო ასახვის დრო დამოკიდებულია provider-სა და ბარათის გამცემზე.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-black text-neutral-900">უკვე აქტიური ციფრული მომსახურება</h2>
              <p className="mt-2">
                პაკეტი წარმატებული გადახდის შემდეგ ავტომატურად იწყებს მუშაობას. თუ მომსახურება სწორად გააქტიურდა და ტექნიკური პრობლემა არ დასტურდება, დაბრუნების მოთხოვნა ინდივიდუალურად განიხილება გამოყენებული პერიოდისა და გარემოებების გათვალისწინებით.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}
