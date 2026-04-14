import type { Metadata } from "next"
import SiteHeader from "@/components/layout/SiteHeader"
import { SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
  title: "წესები და პირობები",
  description: `${SITE_NAME}-ის გამოყენების წესები და პირობები.`,
  alternates: {
    canonical: "/terms",
  },
}

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">იურიდიული ინფორმაცია</div>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">წესები და პირობები</h1>
          <div className="mt-8 space-y-6 leading-7 text-neutral-700">
            <p>{SITE_NAME}-ზე ანგარიშის შექმნითა და პლატფორმის გამოყენებით ეთანხმები ამ პირობებს.</p>
            <section>
              <h2 className="text-xl font-black text-neutral-900">ანგარიში და პასუხისმგებლობა</h2>
              <p className="mt-2">
                მომხმარებელი პასუხისმგებელია თავისი ანგარიშის უსაფრთხოებაზე, განცხადებების სიზუსტეზე და პლატფორმაზე განთავსებული ინფორმაციის კანონიერებაზე.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-black text-neutral-900">აკრძალული ქცევა</h2>
              <p className="mt-2">
                აკრძალულია ყალბი განცხადებები, სხვად გახდომა, თაღლითური გადახდის მცდელობები, სიძულვილის შემცველი კონტენტი, სპამი და პლატფორმის ტექნიკური ბოროტად გამოყენება.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-black text-neutral-900">კონტენტის მოდერაცია</h2>
              <p className="mt-2">
                {SITE_NAME} იტოვებს უფლებას დამალოს, შეზღუდოს ან წაშალოს განცხადებები და ანგარიშები, რომლებიც არღვევს წესებს ან უქმნის რისკს სხვა მომხმარებლებს.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-black text-neutral-900">გარიგებები</h2>
              <p className="mt-2">
                მომხმარებლებს შორის გარიგებები ხორციელდება მათი საკუთარი პასუხისმგებლობით, თუ ცალკე არ არის მითითებული პლატფორმის დამატებითი checkout ან escrow პროცესი.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-black text-neutral-900">ფასიანი ფუნქციები</h2>
              <p className="mt-2">
                VIP, promoted და featured პაკეტები შეიძლება დაემატოს ცალკე ბილინგის პირობებით, მომსახურების წესებითა და დაბრუნების პოლიტიკით.
              </p>
            </section>
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              საბოლოო გამოშვებამდე ეს ტექსტიც იურიდიულ შემოწმებას საჭიროებს.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
