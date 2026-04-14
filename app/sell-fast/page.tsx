import type { Metadata } from "next"
import Link from "next/link"
import SiteHeader from "@/components/layout/SiteHeader"
import { SITE_NAME } from "@/lib/site"

export const metadata: Metadata = {
  title: "როგორ გაყიდო სწრაფად",
  description: `${SITE_NAME}-ზე განცხადების უფრო სწრაფი გაყიდვის პრაქტიკული რჩევები.`,
  alternates: {
    canonical: "/sell-fast",
  },
}

const checklist = [
  {
    title: "გამოიყენე მკაფიო მთავარი ფოტო",
    text: "პირველი ფოტო ყველაზე ძლიერ გავლენას ახდენს გახსნის მაჩვენებელზე. აირჩიე სუფთა განათება, ნეიტრალური ფონი და ნივთის სრული კადრი.",
  },
  {
    title: "დაწერე კონკრეტული სათაური",
    text: "სათაურში ჩასვი ნივთის ტიპი, ბრენდი და მთავარი მახასიათებელი. ზოგადი სათაური ნაკლებად იზიდავს სწორ მყიდველს.",
  },
  {
    title: "აღწერაში თქვი ის, რაც ადამიანებს აინტერესებთ",
    text: "მიუთითე ზომა, მდგომარეობა, მასალა, დეფექტები, როგორ ზის, და მიწოდების ან შეხვედრის პირობები. ეს ამცირებს ზედმეტ კითხვებს.",
  },
  {
    title: "დააყენე რეალისტური ფასი",
    text: "ძალიან მაღალი ფასი ამცირებს კონვერსიას, ხოლო ზედმეტად დაბალი ფასი ეჭვს აჩენს. შეადარე მსგავსი ნივთები კატალოგში და შემდეგ გადაწყვიტე.",
  },
  {
    title: "უპასუხე სწრაფად",
    text: "პირველი სწრაფი პასუხი ხშირად წყვეტს დაინტერესდება თუ არა მყიდველი ბოლომდე. ჩათი ერთ-ერთი ყველაზე ძლიერი კონვერსიის წერტილია.",
  },
  {
    title: "განაახლე და გამოიყენე VIP განთავსება საჭიროებისას",
    text: "თუ ნივთი კარგია, მაგრამ არ ჩანს საკმარისად, შემდეგ ეტაპზე შეგიძლია გამოიყენო VIP განთავსებაც, რომ მეტი ნახვა და ჩათი მიიღო.",
  },
]

export default function SellFastPage() {
  return (
    <main className="min-h-screen bg-neutral-50 text-neutral-900">
      <SiteHeader />
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="rounded-[2rem] border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">გაყიდვის გზამკვლევი</div>
          <h1 className="mt-3 text-3xl font-black sm:text-4xl">როგორ გაყიდო უფრო სწრაფად</h1>
          <p className="mt-4 max-w-3xl leading-7 text-neutral-700">
            ეს მოკლე ჩეკლისტი დაგეხმარება განცხადება ისე მოამზადო, რომ უფრო სწრაფად მიაღწიოს სწორ მყიდველამდე. უმეტეს შემთხვევაში ყველაზე დიდ გავლენას ახდენს ფოტო, სათაური, ფასი და სწრაფი პასუხი.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {checklist.map((item, index) => (
              <div key={item.title} className="rounded-[1.5rem] border border-neutral-200 bg-neutral-50 p-5">
                <div className="flex items-start gap-3">
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-300 bg-white text-sm font-black text-neutral-700">
                    {index + 1}
                  </span>
                  <div>
                    <div className="text-lg font-black text-neutral-900">{item.title}</div>
                    <p className="mt-2 text-sm leading-7 text-neutral-600">{item.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-8 rounded-[1.75rem] border border-neutral-200 bg-neutral-50 p-5">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">სწრაფი მოქმედება</div>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link href="/dashboard/listings/new" className="inline-flex items-center justify-center rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">
                განცხადების დამატება
              </Link>
              <Link href="/catalog" className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-700">
                მსგავსი ნივთების ნახვა
              </Link>
              <Link href="/faq" className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-5 py-3 text-sm font-semibold text-neutral-700">
                ხშირად დასმული კითხვები
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
