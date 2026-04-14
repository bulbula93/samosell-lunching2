import type { Metadata } from "next"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"
import { SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
  title: "უსაფრთხოება",
  description: `${SITE_NAME}-ზე უსაფრთხო ყიდვისა და გაყიდვის ძირითადი წესები.`,
  alternates: {
    canonical: "/safety",
  },
}

const safetyRules = [
  {
    title: "გადაამოწმე პროფილი და განცხადება",
    text: "ყურადღება მიაქციე პროფილის სისრულეს, დამატებულ ფოტოებს, აღწერას, ფასის რეალისტურობას და გამყიდველის კომუნიკაციას. ძალიან ბუნდოვანი ტექსტი და საეჭვოდ დაბალი ფასი სიფრთხილის მიზეზია.",
  },
  {
    title: "ძირითადი დეტალები ჩათში დააზუსტე",
    text: "გაყიდვამდე აუცილებლად ჰკითხე ზომა, მდგომარეობა, დეფექტები, მიწოდება და რეალური ფოტოები. ჩათში შენახული მიმოწერა შემდგომში გაგიადვილებს საკითხის გადამოწმებას.",
  },
  {
    title: "არ გადაუხადო უცნობ გზებზე ბრმად",
    text: "თუ ვინმე დაჩქარებულ გადარიცხვას, უცნაურ ბმულს ან პლატფორმის გარეთ საეჭვო გზას გთავაზობს, ჯერ გადაამოწმე ყველა პირობა. არასოდეს გააზიარო ერთჯერადი კოდები და საბანკო უსაფრთხოების მონაცემები.",
  },
  {
    title: "გამოიყენე რეპორტი საეჭვო ქცევისას",
    text: "თუ შეამჩნიე ყალბი განცხადება, სპამი, სხვად გახდომა ან შეურაცხმყოფელი ქცევა, გამოიყენე რეპორტის ფუნქცია. სწრაფი სიგნალი მოდერაციას ეხმარება სხვა მომხმარებლების დაცვაშიც.",
  },
]

const redFlags = [
  "საეჭვოდ დაბალი ფასი და ძალიან ცოტა დეტალი",
  "მუდმივი ზეწოლა, რომ ახლავე გადაიხადო",
  "უარი დამატებით ფოტოებზე ან კითხვებზე",
  "გადახდის მოთხოვნა შემთხვევით ბმულზე ან უცხო პლატფორმაზე",
  "პროფილი, რომელსაც არ აქვს ნორმალური აღწერა, აქტივობა ან ნდობის ნიშნები",
]

export default function SafetyPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">ნდობა და უსაფრთხოება</div>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">უსაფრთხო ყიდვა და გაყიდვა</h1>
          <p className="mt-4 max-w-3xl leading-7 text-neutral-700">
            {SITE_NAME}-ზე უსაფრთხო გარიგება იწყება ინფორმაციის გადამოწმებით, მკაფიო კომუნიკაციით და საეჭვო ქცევის დროული დაფიქსირებით.
            ეს გვერდი დაგეხმარება სწრაფად გაიარო ძირითადი წესები სანამ შეთანხმებას დაიწყებ.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {safetyRules.map((rule) => (
              <div key={rule.title} className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5">
                <div className="text-lg font-black text-neutral-900">{rule.title}</div>
                <p className="mt-2 text-sm leading-7 text-neutral-600">{rule.text}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[1.75rem] border border-red-200 bg-red-50 p-5">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-red-700">გაფრთხილების ნიშნები</div>
            <ul className="mt-4 space-y-3 text-sm leading-7 text-red-900">
              {redFlags.map((flag) => (
                <li key={flag} className="flex gap-3">
                  <span className="mt-1 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-xs font-black text-red-700">!</span>
                  <span>{flag}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <Link href="/faq" className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 transition hover:border-neutral-300 hover:bg-white">
              <div className="text-base font-black text-neutral-900">ხშირად დასმული კითხვები</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">სწრაფი პასუხები ყველაზე ხშირ შეკითხვებზე განცხადებების, ჩათისა და ნდობის შესახებ.</p>
            </Link>
            <Link href="/contact" className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 transition hover:border-neutral-300 hover:bg-white">
              <div className="text-base font-black text-neutral-900">უსაფრთხოების კონტაქტი</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">თუ კონკრეტული შემთხვევა გაქვს, დახმარების გვერდიდან სწრაფად იპოვი უსაფრთხოების არხს.</p>
            </Link>
            <Link href="/catalog" className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5 transition hover:border-neutral-300 hover:bg-white">
              <div className="text-base font-black text-neutral-900">კატალოგში დაბრუნება</div>
              <p className="mt-2 text-sm leading-6 text-neutral-600">გადადი ნივთებზე უკვე უფრო სწორი ჩეკლისტით და გადაამოწმე რაც მნიშვნელოვანია.</p>
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
