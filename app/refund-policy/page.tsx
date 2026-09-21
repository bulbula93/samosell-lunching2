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
              SamoSell-ის checkout გამოიყენება მხოლოდ VIP, TOP, VIP MAX, Home Banner და Home Brand Ad ციფრული სარეკლამო მომსახურებებისთვის.
              მომხმარებლებს შორის ნივთის გაყიდვის თანხა ამ გადახდის სისტემით არ მუშავდება.
            </p>

            <section>
              <h2 className="text-xl font-black text-neutral-900">როდის ბრუნდება თანხა სრულად</h2>
              <p className="mt-2">
                სრული დაბრუნება შეიძლება განხორციელდეს, თუ ერთი და იგივე შეკვეთის თანხა ორჯერ ჩამოიჭრა; გადახდა წარმატებულია,
                მაგრამ არჩეული მომსახურება ტექნიკური შეცდომის გამო საერთოდ არ გააქტიურდა და პრობლემის აღდგენა ვერ მოხერხდა;
                ან SamoSell-ის სისტემის შეცდომით გააქტიურდა არასწორი პაკეტი, თანხა ან მომსახურება.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-neutral-900">გადახდილი, მაგრამ ჯერ არ გააქტიურებული პაკეტი</h2>
              <p className="mt-2">
                თუ გადახდა დადასტურებულია, მაგრამ მომსახურება ჯერ არ გააქტიურებულა, დაბრუნების მოთხოვნა შეიძლება სრულად დაკმაყოფილდეს
                მას შემდეგ, რაც გადავამოწმებთ შეკვეთასა და provider-ის გადახდის სტატუსს.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-neutral-900">უკვე აქტიური და სწორად მომუშავე მომსახურება</h2>
              <p className="mt-2">
                თუ პაკეტი წარმატებით გააქტიურდა და შეთანხმებული პირობებით მუშაობს, თანხა ავტომატურად არ ბრუნდება მხოლოდ იმიტომ,
                რომ მომხმარებელმა გადაიფიქრა ან მომსახურების გამოყენების გაგრძელება აღარ სურს.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-neutral-900">ტექნიკური პრობლემა აქტიური პაკეტის დროს</h2>
              <p className="mt-2">
                თუ უკვე გააქტიურებულ მომსახურებას ჰქონდა მნიშვნელოვანი ტექნიკური პრობლემა და შეთანხმებული სარეკლამო განთავსება სრულად
                ან ნაწილობრივ ვერ შესრულდა, შემთხვევა ინდივიდუალურად მოწმდება. გარემოებების მიხედვით შეიძლება დამტკიცდეს სრული ან ნაწილობრივი დაბრუნება.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-neutral-900">როგორ მოითხოვო დაბრუნება</h2>
              <p className="mt-2">
                მოგვწერე <a href={`mailto:${support.supportEmail}`} className="font-semibold text-[#073f3b] underline underline-offset-4">{support.supportEmail}</a>-ზე
                და მიუთითე ანგარიშის ელფოსტა, მომსახურების სახელი ან კოდი, შეკვეთის/გადახდის იდენტიფიკატორი და პრობლემის მოკლე აღწერა.
                ბარათის სრული ნომერი ან CVV არ გამოგზავნო.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-neutral-900">როგორ ხდება დაბრუნება</h2>
              <p className="mt-2">
                SamoSell ამოწმებს შეკვეთას და Flitt/provider-ის გადახდის ჩანაწერს. დამტკიცებული დაბრუნება ინიცირდება იმავე გადახდის არხზე,
                საიდანაც თანხა იყო მიღებული. სხვა ბარათზე ან სხვა ანგარიშზე ხელით გადარიცხვა არ გამოიყენება.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-black text-neutral-900">როდის აისახება თანხა</h2>
              <p className="mt-2">
                დაბრუნების დამტკიცებისა და provider-ში ინიცირების შემდეგ თანხის საბოლოო ასახვის დრო დამოკიდებულია Flitt-ზე,
                ბანკსა და ბარათის გამცემზე. ამიტომ ანგარიშზე მყისიერი ასახვა გარანტირებული არ არის.
              </p>
            </section>
          </div>
        </div>
      </section>
    </main>
  )
}
