import type { Metadata } from "next"
import SiteHeader from "@/components/layout/SiteHeader"
import { SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
  title: "კონფიდენციალურობის პოლიტიკა",
  description: `${SITE_NAME}-ის კონფიდენციალურობის პოლიტიკა.`,
  alternates: {
    canonical: "/privacy-policy",
  },
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <SiteHeader />
      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">იურიდიული ინფორმაცია</div>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">კონფიდენციალურობის პოლიტიკა</h1>
          <div className="mt-8 space-y-6 leading-7 text-neutral-700">
            <p>
              {SITE_NAME} აგროვებს მხოლოდ იმ ინფორმაციას, რომელიც საჭიროა ანგარიშის შესაქმნელად, განცხადებების გამოსაქვეყნებლად,
              ჩათის ფუნქციისთვის, ბოროტად გამოყენების პრევენციისთვის და პლატფორმის უსაფრთხო ოპერირებისთვის.
            </p>
            <section>
              <h2 className="text-xl font-black text-neutral-900">რა მონაცემებს ვაგროვებთ</h2>
              <p className="mt-2">
                ეს შეიძლება მოიცავდეს ანგარიშის მონაცემებს, პროფილის ინფორმაციას, განცხადებების ტექსტს, ფოტოებს, ჩათის შეტყობინებებს,
                ფავორიტებს, რეპორტებს და ტექნიკურ ლოგებს, რომლებიც საჭიროა შეცდომების დიაგნოსტიკისა და დაცვისთვის.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-black text-neutral-900">რისთვის ვიყენებთ ამ მონაცემებს</h2>
              <p className="mt-2">
                მონაცემები გამოიყენება ანგარიშის ავტორიზაციისთვის, ნივთების ჩვენებისთვის, ჩათისთვის, უსაფრთხოების მონიტორინგისთვის,
                ბოროტად გამოყენების პრევენციისთვის და მომხმარებლის მხარდაჭერისთვის.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-black text-neutral-900">ვიზიარებთ თუ არა მონაცემებს</h2>
              <p className="mt-2">
                ჩვენ არ ვყიდით მომხმარებლის მონაცემებს. ინფორმაცია შეიძლება დამუშავდეს მხოლოდ იმ სერვისების მიერ, რომლებიც აუცილებელია
                პლატფორმის მუშაობისთვის, მაგალითად hosting, მონაცემთა ბაზა, ავთენტიკაცია და უსაფრთხოების ინფრასტრუქტურა.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-black text-neutral-900">შენახვის ვადა</h2>
              <p className="mt-2">
                მონაცემები ინახება იმდენ ხანს, რამდენიც საჭიროა პლატფორმის ოპერირებისთვის, იურიდიული ვალდებულებების შესასრულებლად
                ან უსაფრთხოების შემთხვევების გამოსაძიებლად.
              </p>
            </section>
            <section>
              <h2 className="text-xl font-black text-neutral-900">შენი უფლებები</h2>
              <p className="mt-2">
                შეგიძლია მოითხოვო პროფილის ინფორმაციის შესწორება, ანგარიშის დახურვა ან მხარდაჭერასთან დაკავშირება მონაცემების დამუშავების შესახებ კითხვებით.
              </p>
            </section>
            <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              საბოლოო გამოშვებამდე ეს ტექსტი იურისტმა უნდა გადაამოწმოს კონკრეტული იურისდიქციის მოთხოვნებთან.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
